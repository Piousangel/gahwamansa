-- 0036 푸시 보안 리뷰 반영(docs/team/reviews/2026-11-18-push-tokens-review.md, 조건부 → M1~M6·낮음)
-- M1 앱 역할(authenticated·anon)의 TRUNCATE·REFERENCES·TRIGGER를 public 전 표에서 회수 + postgres가 앞으로 만들 표의 기본 권한에서도 제거.
--    TRUNCATE는 RLS를 타지 않는다. 지금 API로는 경로가 없지만 다층 방어(0035는 content 두 표만이었음).
-- M2 register_push_token: 연결 전 계정(no_profile)이어도 "같은 토큰의 다른 계정 행 삭제"는 먼저 한다(기기 소유 주장 → 오배달 방지), 삽입만 생략.
-- L2 device_tokens.token 표 전체 유일 + insert on conflict(token) 한 문장(동시 등록 경합 제거), 사용자당 5개 정리는 사용자 잠금 뒤.
-- M5·M6 profiles.push_consented_at: N1 "알림 받기"를 누른 시각(set_push_enabled(true)에서 기록, false에서 null). 일일 알림 대상 조건에 추가.
--    OS 권한 허용·토큰 존재를 수신 의사로 갈음하지 않는다(KISA 해석 대비). 기본값이 없으므로 받기를 누르기 전에는 보내지 않는다.
-- M4 push_claims(kind, sent_on, profile_id) 유일 선점: push_daily_claim()이 발송 전에 선점(insert on conflict do nothing) →
--    동시 실행·재시도·기록 실패에도 같은 날 같은 어르신께 두 번 가지 않는다(실패하면 그날은 재시도하지 않음: 두 번보다 한 번 놓침이 낫다).
-- M3(서버 쪽 방어) push_record: 한 실행에서 무효 토큰이 5개 이상이고 절반을 넘으면 설정 오류로 보고 토큰을 지우지 않는다(note에 invalid_ratio_hold).
--    실행 메모 push_runs.note(config_error 등)를 받는다. 오류 분류 자체는 Edge Function(lib.mts)이 UNREGISTERED·message.token 오류만 무효로 본다.
-- L3 파기 배치: 270일 넘게 갱신 안 된 토큰 삭제(FCM 비활성 기준), 선점 기록 31일.
-- L9 set_push_enabled(null)은 invalid(끈 알림이 실수로 켜지지 않게).

revoke truncate, references, trigger on all tables in schema public from authenticated, anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated, anon;

-- L2: 토큰 유일(중복이 있으면 가장 최근 것만 남긴다)
delete from public.device_tokens d
 using public.device_tokens n
 where d.token = n.token and (d.updated_at, d.user_id::text) < (n.updated_at, n.user_id::text);
drop index if exists public.device_tokens_token_idx;
create unique index device_tokens_token_key on public.device_tokens (token);

create or replace function public.register_push_token(p_token text, p_platform text default 'android') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_token is null or char_length(p_token) not between 20 and 4096 or p_token !~ '^[A-Za-z0-9_:-]+$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  if p_platform is null or p_platform not in ('android', 'ios') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_platform');
  end if;
  -- 이 기기(토큰)의 이전 계정 행은 연결 여부와 상관없이 먼저 지운다(M2)
  delete from public.device_tokens where token = p_token and user_id <> v_uid;
  if public.my_profile_id() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (v_uid, p_token, p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
  perform pg_advisory_xact_lock(hashtext('push_tokens:' || v_uid::text));
  delete from public.device_tokens
   where user_id = v_uid
     and token not in (select token from public.device_tokens where user_id = v_uid order by updated_at desc, token limit 5);
  return jsonb_build_object('ok', true);
end $$;

alter table public.profiles add column push_consented_at timestamptz; -- authenticated 직접 읽기 미부여

create or replace function public.set_push_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_enabled is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if public.my_profile_id() is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  update public.profiles
     set push_enabled = p_enabled,
         push_consented_at = case when p_enabled then now() else null end
   where id = public.my_profile_id();
  return jsonb_build_object('ok', true, 'enabled', p_enabled);
end $$;

-- enabled = 실제로 받는 상태(켬 + 받기 시각 있음). 받기를 누르기 전에는 false.
create or replace function public.my_push_settings() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('enabled',
    (select push_enabled and push_consented_at is not null from public.profiles where user_id = auth.uid()))
$$;

create table public.push_claims (
  kind text not null check (kind in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected')),
  sent_on date not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  claimed_at timestamptz not null default now(),
  primary key (kind, sent_on, profile_id)
);
alter table public.push_claims enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.push_claims from public, anon, authenticated;
alter table public.push_runs add column note text check (char_length(note) <= 40);

-- 내부: 그날 일일 알림을 받을 수 있는 어르신(선점·발송 여부 포함 판단)
create function public.push_daily_eligible(p_today date) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
    from public.profiles p
    join public.families f on f.id = p.family_id
   where p.role = 'parent' and p.user_id is not null and p.consented_at is not null
     and p.push_enabled and p.push_consented_at is not null
     and not f.is_review
     and not exists (select 1 from public.daily_sessions ds
                      where ds.parent_id = p.id and ds.session_date = p_today and ds.completed_at is not null)
     and not exists (select 1 from public.push_claims c where c.kind = 'daily' and c.sent_on = p_today and c.profile_id = p.id)
     and not exists (select 1 from public.push_log l
                      where l.kind = 'daily' and l.profile_id = p.id and l.sent_on = p_today and l.status = 'sent')
     and exists (select 1 from public.device_tokens dt where dt.user_id = p.user_id)
$$;
revoke execute on function public.push_daily_eligible(date) from public, anon, authenticated;

-- 미리보기(읽기 전용, 0033 계약 유지): 선점하지 않는다
create or replace function public.push_daily_targets(p_now timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_open boolean := extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20;
  v_targets jsonb;
  v_n int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', p.id, 'token', dt.token, 'platform', dt.platform) order by p.id, dt.token), '[]'::jsonb),
         count(distinct p.id)
    into v_targets, v_n
    from public.profiles p join public.device_tokens dt on dt.user_id = p.user_id
   where v_open and p.id in (select public.push_daily_eligible(v_today));
  return jsonb_build_object(
    'window_open', v_open,
    'local_time', to_char(p_now at time zone 'Asia/Seoul', 'HH24:MI'),
    'copy', (select jsonb_build_object('title', c.title, 'body', c.body) from public.push_copy c where c.kind = 'daily'),
    'targets', v_targets,
    'excluded', (select count(*)::int from public.profiles p join public.families f on f.id = p.family_id
                  where p.role = 'parent' and not f.is_review) - v_n);
end $$;

-- 발송용: 창 안이고 문구가 있으면 대상을 선점하고 그 토큰만 돌려준다(같은 날 같은 어르신은 한 실행만 받음)
create function public.push_daily_claim(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_open boolean := extract(hour from (p_now at time zone 'Asia/Seoul')) between 8 and 20;
  v_copy jsonb := (select jsonb_build_object('title', c.title, 'body', c.body) from public.push_copy c where c.kind = 'daily');
  v_claimed uuid[];
  v_targets jsonb;
begin
  if v_open and v_copy is not null then
    with ins as (
      insert into public.push_claims (kind, sent_on, profile_id)
      select 'daily', v_today, e from public.push_daily_eligible(v_today) e
      on conflict do nothing
      returning profile_id)
    select coalesce(array_agg(profile_id), '{}') into v_claimed from ins;
  else
    v_claimed := '{}';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', p.id, 'token', dt.token, 'platform', dt.platform) order by p.id, dt.token), '[]'::jsonb)
    into v_targets
    from public.profiles p join public.device_tokens dt on dt.user_id = p.user_id
   where p.id = any (v_claimed);
  return jsonb_build_object(
    'window_open', v_open,
    'copy', v_copy,
    'targets', v_targets,
    'excluded', (select count(*)::int from public.profiles p join public.families f on f.id = p.family_id
                  where p.role = 'parent' and not f.is_review) - cardinality(v_claimed));
end $$;

drop function public.push_record(text, jsonb, int, timestamptz);
create function public.push_record(p_kind text, p_results jsonb, p_excluded int default 0, p_now timestamptz default now(), p_note text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  v_res jsonb := coalesce(p_results, '[]'::jsonb);
  v_sent int; v_failed int; v_invalid int;
  v_note text := p_note;
begin
  if p_kind is null or p_kind not in ('daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected') then
    raise exception 'invalid_kind';
  end if;
  if jsonb_typeof(v_res) <> 'array'
     or exists (select 1 from jsonb_array_elements(v_res) r where coalesce(r ->> 'status', '') not in ('sent', 'failed', 'invalid_token')) then
    raise exception 'invalid_status';
  end if;
  select count(*) filter (where r ->> 'status' = 'sent'), count(*) filter (where r ->> 'status' = 'failed'),
         count(*) filter (where r ->> 'status' = 'invalid_token')
    into v_sent, v_failed, v_invalid
    from jsonb_array_elements(v_res) r;

  insert into public.push_log (kind, sent_on, profile_id, status)
  select p_kind, v_today, (r ->> 'profile_id')::uuid, r ->> 'status'
    from jsonb_array_elements(v_res) r
   where exists (select 1 from public.profiles p where p.id = (r ->> 'profile_id')::uuid);

  -- 무효가 많으면(5개 이상·절반 초과) 설정 오류로 보고 토큰을 지우지 않는다
  if v_invalid >= 5 and v_invalid * 2 > jsonb_array_length(v_res) then
    v_note := coalesce(v_note || ',', '') || 'invalid_ratio_hold';
  else
    delete from public.device_tokens dt
     using jsonb_array_elements(v_res) r
     where r ->> 'status' = 'invalid_token' and dt.token = r ->> 'token';
  end if;

  update public.push_claims c
     set status = case when exists (select 1 from jsonb_array_elements(v_res) r
                                     where (r ->> 'profile_id')::uuid = c.profile_id and r ->> 'status' = 'sent') then 'sent' else 'failed' end
   where c.kind = p_kind and c.sent_on = v_today and c.status = 'pending'
     and c.profile_id in (select (r ->> 'profile_id')::uuid from jsonb_array_elements(v_res) r);

  insert into public.push_runs (kind, run_at, targets, sent, failed, invalid, excluded, note)
  values (p_kind, p_now, jsonb_array_length(v_res), v_sent, v_failed, v_invalid, coalesce(p_excluded, 0), left(v_note, 40));
  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'invalid', v_invalid, 'note', v_note);
end $$;

revoke execute on function public.push_daily_claim(timestamptz), public.push_record(text, jsonb, int, timestamptz, text) from public, anon, authenticated;
grant execute on function public.push_daily_claim(timestamptz), public.push_record(text, jsonb, int, timestamptz, text) to service_role;

-- purge_expired_data(0033) + 270일 지난 토큰·선점 기록 31일(L3)
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int; n_push_log int; n_push_runs int; n_tokens int; n_claims int;
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
  delete from public.device_tokens where updated_at < p_now - interval '270 days';
  get diagnostics n_tokens = row_count;
  delete from public.push_claims where claimed_at < p_now - interval '31 days';
  get diagnostics n_claims = row_count;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs,
                            'device_tokens', n_tokens, 'push_claims', n_claims);
end $$;
