-- 0033 일일 푸시 발송(로드맵 SV-02, 결정 D-07: 하루 1회 09:00 KST, 창 08:00~20:59)
-- 흐름: pg_cron 'push-daily'(00:00 UTC = 09:00 KST) → push_daily_kick()이 pg_net으로 Edge Function `push-daily` 호출
--       → 함수가 push_daily_targets()로 대상·문구를 받아 FCM HTTP v1로 보내고 push_record()로 결과를 남긴다.
-- 대상(어르신만): 연결됨(user_id 있음)·동의함·알림 켬(profiles.push_enabled)·심사 가족 아님·오늘 코스 안 마침·오늘 아직 안 보냄·토큰 있음.
--   비동의 어르신 제외: 답을 나누지 않는 분께 매일 부르는 알림을 보내지 않는다(로드맵 SV-02 원문).
-- 발송 창: KST 08:00~20:59 밖이면 targets=[] (재시도가 밤에 나가지 않게, 광고성 정보 야간 전송 제한과 같은 범위).
-- 문구: push_copy(kind)에서 읽는다. 확정 문구(WR-02, 혜택·유료·재방문 압박 금지, 법률 리뷰)가 들어오기 전에는 copy=null → 함수가 보내지 않는다(임시 문구 금지).
-- 기록: push_log(토큰 단위 결과, 31일 보관) + push_runs(실행 요약: 대상·보냄·실패·무효·제외, 13개월 보관). 무효 토큰은 즉시 삭제.
-- 알림 끄기: set_push_enabled(본인, 어르신·자녀 공통). 자녀 알림(N3)·응원 도착(N2) 발송(SV-03)도 이 값을 따른다.
-- cron 호출 설정(환경마다, 사용자): Vault 비밀 `project_url`(https://<ref>.supabase.co), `push_cron_secret`(임의 긴 문자열) +
--   Edge Function secrets `PUSH_CRON_SECRET`(같은 값)·`FCM_SERVICE_ACCOUNT`(서비스 계정 JSON). 없으면 kick은 not_configured만 돌려준다.

create extension if not exists pg_net with schema extensions; -- 함수는 net 스키마(net.http_post), 확장 자체는 public 밖(advisors extension_in_public)

alter table public.profiles add column push_enabled boolean not null default true; -- authenticated 직접 읽기 미부여(my_push_settings로)

create table public.push_copy (
  kind text primary key check (kind in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected')),
  title text not null check (char_length(title) between 1 and 30),
  body text not null check (char_length(body) between 1 and 60),
  updated_at timestamptz not null default now()
);
create table public.push_log (
  id bigserial primary key,
  kind text not null check (kind in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected')),
  sent_on date not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'invalid_token')),
  created_at timestamptz not null default now()
);
create index on public.push_log (kind, sent_on, profile_id) where status = 'sent';
create index on public.push_log (created_at);
create table public.push_runs (
  id bigserial primary key,
  kind text not null,
  run_at timestamptz not null default now(),
  targets int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  invalid int not null default 0,
  excluded int not null default 0
);
alter table public.push_copy enable row level security;
alter table public.push_log enable row level security;
alter table public.push_runs enable row level security; -- 세 표 모두 정책 없음 = 클라이언트 전면 거부
revoke all on public.push_copy, public.push_log, public.push_runs from public, anon, authenticated;
revoke all on sequence public.push_log_id_seq, public.push_runs_id_seq from public, anon, authenticated;
grant select on public.push_copy, public.push_log, public.push_runs to service_role;

-- 서비스 역할 전용: {window_open, copy:{title,body}|null, targets:[{profile_id, token, platform}], excluded}
create function public.push_daily_targets(p_now timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Asia/Seoul';
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_open boolean := extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20;
  v_targets jsonb;
  v_target_profiles int;
begin
  with t as (
    select p.id as profile_id, dt.token, dt.platform
      from public.profiles p
      join public.families f on f.id = p.family_id
      join public.device_tokens dt on dt.user_id = p.user_id
     where v_open
       and p.role = 'parent' and p.user_id is not null and p.consented_at is not null and p.push_enabled
       and not f.is_review
       and not exists (select 1 from public.daily_sessions ds
                        where ds.parent_id = p.id and ds.session_date = v_today and ds.completed_at is not null)
       and not exists (select 1 from public.push_log l
                        where l.kind = 'daily' and l.profile_id = p.id and l.sent_on = v_today and l.status = 'sent')
  )
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', profile_id, 'token', token, 'platform', platform)
                            order by profile_id, token), '[]'::jsonb),
         count(distinct profile_id)
    into v_targets, v_target_profiles
    from t;
  return jsonb_build_object(
    'window_open', v_open,
    'local_time', to_char(v_local, 'HH24:MI'),
    'copy', (select jsonb_build_object('title', c.title, 'body', c.body) from public.push_copy c where c.kind = 'daily'),
    'targets', v_targets,
    'excluded', (select count(*)::int from public.profiles p join public.families f on f.id = p.family_id
                  where p.role = 'parent' and not f.is_review) - v_target_profiles);
end $$;

-- 서비스 역할 전용: 결과 [{profile_id, token, status: sent|failed|invalid_token}] 기록, 무효 토큰 삭제, 실행 요약
create function public.push_record(p_kind text, p_results jsonb, p_excluded int default 0, p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_sent int; v_failed int; v_invalid int;
begin
  if p_kind is null or p_kind not in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected') then
    raise exception 'invalid_kind';
  end if;
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r
                 where coalesce(r ->> 'status', '') not in ('sent', 'failed', 'invalid_token')) then
    raise exception 'invalid_status';
  end if;
  insert into public.push_log (kind, sent_on, profile_id, status)
  select p_kind, v_today, (r ->> 'profile_id')::uuid, r ->> 'status'
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r
   where exists (select 1 from public.profiles p where p.id = (r ->> 'profile_id')::uuid);
  delete from public.device_tokens dt
   using jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r
   where r ->> 'status' = 'invalid_token' and dt.token = r ->> 'token';
  select count(*) filter (where r ->> 'status' = 'sent'), count(*) filter (where r ->> 'status' = 'failed'),
         count(*) filter (where r ->> 'status' = 'invalid_token')
    into v_sent, v_failed, v_invalid
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r;
  insert into public.push_runs (kind, run_at, targets, sent, failed, invalid, excluded)
  values (p_kind, p_now, jsonb_array_length(coalesce(p_results, '[]'::jsonb)), v_sent, v_failed, v_invalid, coalesce(p_excluded, 0));
  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'invalid', v_invalid);
end $$;

-- 본인(어르신·자녀): 알림 켜기/끄기. 연결 전 기기는 no_profile.
create function public.set_push_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if public.my_profile_id() is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  update public.profiles set push_enabled = coalesce(p_enabled, true) where id = public.my_profile_id();
  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, true));
end $$;

create function public.my_push_settings() returns jsonb
language sql stable security definer set search_path = ''
as $$ select jsonb_build_object('enabled', (select push_enabled from public.profiles where user_id = auth.uid())) $$;

-- 서비스 역할 전용(cron): Vault의 project_url·push_cron_secret이 있으면 Edge Function을 부른다
create function public.push_daily_kick() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
  v_req bigint;
begin
  if v_url is null or v_secret is null then
    return jsonb_build_object('status', 'not_configured');
  end if;
  select net.http_post(
           url := rtrim(v_url, '/') || '/functions/v1/push-daily',
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
           body := '{}'::jsonb,
           timeout_milliseconds := 60000)
    into v_req;
  return jsonb_build_object('status', 'requested', 'request_id', v_req);
end $$;

revoke execute on function public.push_daily_targets(timestamptz), public.push_record(text, jsonb, int, timestamptz),
  public.push_daily_kick() from public, anon, authenticated;
grant execute on function public.push_daily_targets(timestamptz), public.push_record(text, jsonb, int, timestamptz),
  public.push_daily_kick() to service_role;
revoke execute on function public.set_push_enabled(boolean), public.my_push_settings() from public, anon;
grant execute on function public.set_push_enabled(boolean), public.my_push_settings() to authenticated;

select cron.schedule('push-daily', '0 0 * * *', 'select public.push_daily_kick()');

-- purge_expired_data(0028) + 발송 기록 31일·실행 요약 13개월
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int; n_push_log int; n_push_runs int;
begin
  delete from public.answers where session_date < v_today - 30;
  get diagnostics n_answers = row_count;
  delete from public.daily_sessions where session_date < v_today - 30;
  get diagnostics n_sessions = row_count;
  delete from public.cheers where sent_at < p_now - interval '31 days';
  get diagnostics n_cheers = row_count;
  delete from public.invite_codes
   where used_at < p_now - interval '30 days'
      or (used_at is null and expires_at < p_now - interval '30 days');
  get diagnostics n_codes = row_count;
  delete from public.redeem_attempts where at < p_now - interval '30 days';
  get diagnostics n_attempts = row_count;
  delete from public.events where ts < p_now - interval '14 months';
  get diagnostics n_events = row_count;
  delete from public.notification_queue where created_at < p_now - interval '30 days';
  get diagnostics n_queue = row_count;
  delete from public.push_log where created_at < p_now - interval '31 days';
  get diagnostics n_push_log = row_count;
  delete from public.push_runs where run_at < p_now - interval '13 months';
  get diagnostics n_push_runs = row_count;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs);
end $$;
