-- 0042 카카오 연결 해제(로드맵 SV-06, 리뷰 R-SL 2·S08 R10): 계정을 지우면 카카오 앱 연결도 끊는다(카카오 "연결 끊기" 의무, 재가입 시 동의 다시 받기).
-- 흐름: 계정 삭제(account_delete_core — 앱 delete_my_account·관리자 admin_delete_account 공통)에서 인증 계정을 지우기 **직전에**
--       auth.identities의 카카오 회원번호(provider_id)를 kakao_unlink_queue에 넣는다 → cron 'kakao-unlink' 10분마다(할 일 있을 때만)
--       → Edge Function `kakao-unlink`(secrets KAKAO_ADMIN_KEY)이 kakao_unlink_claim으로 선점해 POST https://kapi.kakao.com/v1/user/unlink
--       (Authorization: KakaoAK {Admin 키}, target_id_type=user_id) → kakao_unlink_record로 결과.
-- 재시도: 실패마다 다음 시도 2^n분 뒤(최대 24시간), 10번 실패하면 gave_up_at(운영자 확인) → 30일 뒤 파기. 성공·이미 해제는 행을 바로 지운다
--         (회원번호는 해제를 위해서만 잠시 보관, 처리방침 "탈퇴 즉시~30일 내 삭제"와 일치).
-- 앱 접근 불가(서비스 역할만). 구글·이메일·익명 계정은 대상이 아니다(구글은 앱 쪽 연결 해제가 필요 없음).

create table public.kakao_unlink_queue (
  id bigserial primary key,
  kakao_user_id text not null check (char_length(kakao_user_id) between 1 and 64),
  enqueued_at timestamptz not null default now(),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_http int,
  gave_up_at timestamptz
);
create index on public.kakao_unlink_queue (next_attempt_at) where gave_up_at is null;
alter table public.kakao_unlink_queue enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.kakao_unlink_queue from public, anon, authenticated;
revoke all on sequence public.kakao_unlink_queue_id_seq from public, anon, authenticated;

-- 서비스 역할: 대기 중인 것 선점(시도 횟수·다음 시도 시각을 올림). [{id, kakao_user_id}]
create function public.kakao_unlink_claim(p_limit int default 50, p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  with c as (
    select id from public.kakao_unlink_queue
     where gave_up_at is null and next_attempt_at <= p_now
     order by next_attempt_at, id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
     for update skip locked),
  u as (
    update public.kakao_unlink_queue q
       set attempts = q.attempts + 1,
           next_attempt_at = p_now + least(interval '1 minute' * power(2, q.attempts + 1), interval '24 hours')
      from c where q.id = c.id
    returning q.id, q.kakao_user_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kakao_user_id', kakao_user_id) order by id), '[]'::jsonb) into v from u;
  return v;
end $$;

-- 서비스 역할: 결과 [{id, status: done|retry, http?}]. done은 행 삭제, retry는 10번째면 포기 표시.
create function public.kakao_unlink_record(p_results jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_done int; v_retry int; v_gave int;
begin
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r where coalesce(r ->> 'status', '') not in ('done', 'retry')) then
    raise exception 'invalid_status';
  end if;
  delete from public.kakao_unlink_queue q using jsonb_array_elements(p_results) r
   where r ->> 'status' = 'done' and q.id = (r ->> 'id')::bigint;
  get diagnostics v_done = row_count;
  update public.kakao_unlink_queue q
     set last_http = nullif(r ->> 'http', '')::int,
         gave_up_at = case when q.attempts >= 10 then now() else null end
    from jsonb_array_elements(p_results) r
   where r ->> 'status' = 'retry' and q.id = (r ->> 'id')::bigint;
  get diagnostics v_retry = row_count;
  select count(*) into v_gave from public.kakao_unlink_queue q, jsonb_array_elements(p_results) r
   where r ->> 'status' = 'retry' and q.id = (r ->> 'id')::bigint and q.gave_up_at is not null;
  return jsonb_build_object('done', v_done, 'retry', v_retry - v_gave, 'gave_up', v_gave);
end $$;

-- 내부 호출(0038 push_kick)에 kakao-unlink 추가
create or replace function public.push_kick(p_function text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
  v_req bigint;
begin
  if p_function not in ('push-daily', 'push-events', 'kakao-unlink') then raise exception 'invalid_function'; end if;
  if v_url is null or v_secret is null then return jsonb_build_object('status', 'not_configured'); end if;
  select net.http_post(
           url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
           body := '{}'::jsonb,
           timeout_milliseconds := 60000)
    into v_req;
  return jsonb_build_object('status', 'requested', 'request_id', v_req);
end $$;

create function public.kakao_unlink_kick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.kakao_unlink_queue where gave_up_at is null and next_attempt_at <= p_now) then
    return jsonb_build_object('status', 'nothing_to_send');
  end if;
  return public.push_kick('kakao-unlink');
end $$;

revoke execute on function public.kakao_unlink_claim(int, timestamptz), public.kakao_unlink_record(jsonb), public.kakao_unlink_kick(timestamptz)
  from public, anon, authenticated;
grant execute on function public.kakao_unlink_claim(int, timestamptz), public.kakao_unlink_record(jsonb), public.kakao_unlink_kick(timestamptz) to service_role;

select cron.schedule('kakao-unlink', '*/10 * * * *', 'select public.kakao_unlink_kick()');

-- account_delete_core(0039) + 카카오 해제 큐 넣기
create or replace function public.account_delete_core(p_profile uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
  v_scope text;
  v_parent_uids uuid[];
begin
  select * into v_p from public.profiles where id = p_profile;
  if not found then return null; end if;

  if v_p.role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_p.family_id and role = 'child' and id <> v_p.id
  ) then
    select coalesce(array_agg(user_id), '{}') into v_parent_uids
      from public.profiles where family_id = v_p.family_id and role = 'parent' and user_id is not null;
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_p.family_id and user_id is not null);
    delete from public.families where id = v_p.family_id;
    delete from auth.users where id = any (v_parent_uids) and is_anonymous;
    v_scope := 'family';
  else
    if v_p.user_id is not null then
      delete from public.device_tokens where user_id = v_p.user_id;
    end if;
    delete from public.profiles where id = v_p.id;
    v_scope := v_p.role;
  end if;

  if v_p.user_id is not null then
    -- 0042: 인증 계정(식별자 cascade)을 지우기 전에 카카오 회원번호를 해제 큐에 넣는다
    insert into public.kakao_unlink_queue (kakao_user_id)
    select provider_id from auth.identities where user_id = v_p.user_id and provider = 'kakao';
    delete from auth.users where id = v_p.user_id;
  end if;
  return jsonb_build_object('scope', v_scope);
end $$;

-- purge_expired_data(0039) + 해제 큐 30일(포기·오래된 것)
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int; n_push_log int; n_push_runs int; n_tokens int; n_claims int; n_audit int; n_kakao int;
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
  -- 감사 행은 1년 보관 후 이 배치만 지운다(트리거 예외는 이 트랜잭션 안에서만)
  perform set_config('bumo.allow_audit_purge', 'on', true);
  delete from public.admin_audit where at < p_now - interval '1 year';
  get diagnostics n_audit = row_count;
  perform set_config('bumo.allow_audit_purge', 'off', true);
  delete from public.kakao_unlink_queue where gave_up_at < p_now - interval '30 days' or enqueued_at < p_now - interval '30 days';
  get diagnostics n_kakao = row_count;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs,
                            'device_tokens', n_tokens, 'push_claims', n_claims, 'admin_audit', n_audit, 'kakao_unlink_queue', n_kakao);
end $$;
