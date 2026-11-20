-- 0057 연결 전·옛 익명 계정 자동 정리(법률 PR #154, 법 제21조 파기 원칙, 방침 v2.5 4·10절·삭제 안내 2절 자리표시 P21, dev-server-notes §19 ①).
-- 대상: 익명(auth.users.is_anonymous) + 프로필 없음(가족과 한 번도 연결하지 않은 어르신 기기, 또는 재연결로 프로필이 새 기기로 옮겨 가 비워진 옛 익명 계정)
--       + 마지막 활동이 정리 기간(stale_anon_days() = 90일, 오너 확정 DECISIONS 11-20 — 바꿀 때는 이 함수 한 곳과 방침 4절·삭제 안내 2절을 함께) 넘음.
--   마지막 활동 = 가입·마지막 로그인·사용자 행 갱신·세션 갱신·리프레시 토큰 갱신 중 가장 늦은 것(앱을 열면 토큰 갱신으로 세션이 갱신된다).
--   연결된 어르신(프로필 있음)·자녀(소셜 계정, 익명 아님)는 대상이 아니다.
-- 지울 범위: 앱 delete_my_account의 연결 전 경로와 같은 공통 함수(user_delete_core) — 토큰, 카카오 해제 큐(익명은 없음), 인증 계정 → 약관 확인 기록(terms_agreements)·
--   identities·세션 cascade. 기록: 식별자 없는 측정 행 account_purged(props {scope:'stale_anonymous'}, 시 단위 시각) — 탈퇴(account_deleted)와 섞이지 않게 이름을 나눈다.
-- 실행: 기존 파기 배치 purge_expired_data(cron purge-expired-data, 매일 00:10 KST)의 한 단계. 한 번에 최대 500명.
--   이 단계가 실패해도(예: 원격에서 auth 표 권한 문제) 다른 파기는 계속한다(예외 블록, warning). 결과 키 stale_anonymous(-1 = 이 단계 실패).
--   06시 점검(§14)은 전날 account_purged 수와 이 키를 본다.

create function public.stale_anon_days() returns int
language sql immutable set search_path = ''
as $$ select 90 $$; -- 정리 기간(일, 오너 확정 11-20). 방침·삭제 안내의 {연결 전 계정 자동 정리 기간} = 90일(P21)
revoke execute on function public.stale_anon_days() from public, anon, authenticated;

-- user_delete_core(0054)에 기록할 이벤트 이름을 받는 판. 1인자 판(앱·관리자 경로)은 그대로 account_deleted.
create function public.user_delete_core(p_user uuid, p_event text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_event not in ('account_deleted', 'account_purged') then raise exception 'invalid_event'; end if;
  perform 1 from auth.users where id = p_user for update;
  if not found then return null; end if;
  if exists (select 1 from public.profiles where user_id = p_user) then return jsonb_build_object('scope', 'has_profile'); end if;
  delete from public.device_tokens where user_id = p_user;
  insert into public.kakao_unlink_queue (kakao_user_id)
  select provider_id from auth.identities where user_id = p_user and provider = 'kakao';
  delete from auth.users where id = p_user;
  begin
    insert into public.events (ts, family_id, profile_id, device_key, actor_role, name, props)
    values (date_trunc('hour', now()), null, null, null, 'none', p_event,
            case when p_event = 'account_purged' then jsonb_build_object('scope', 'stale_anonymous')
                 else jsonb_build_object('scope', 'none', 'role', 'none') end);
  exception when others then
    raise warning '%_event_failed: %', p_event, sqlstate; -- 측정 실패는 삭제를 막지 않는다(0054 L1)
  end;
  return jsonb_build_object('scope', 'none');
end $$;
revoke execute on function public.user_delete_core(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.user_delete_core(p_user uuid) returns jsonb
language sql security definer set search_path = ''
as $$ select public.user_delete_core(p_user, 'account_deleted') $$;

-- 정리 대상(읽기 전용, 테스트·점검용): 마지막 활동이 기준 시각 - 정리 기간보다 이른 프로필 없는 익명 사용자
create function public.stale_anonymous_users(p_now timestamptz default now(), p_limit int default 500) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select u.id
    from auth.users u
   where u.is_anonymous
     and not exists (select 1 from public.profiles p where p.user_id = u.id)
     and greatest(u.created_at, u.last_sign_in_at, u.updated_at,
                  (select max(coalesce(s.updated_at, s.created_at)) from auth.sessions s where s.user_id = u.id),
                  (select max(coalesce(r.updated_at, r.created_at)) from auth.refresh_tokens r where r.user_id = u.id::text))
         < p_now - make_interval(days => public.stale_anon_days())
   order by u.created_at
   limit greatest(coalesce(p_limit, 0), 0)
$$;
revoke execute on function public.stale_anonymous_users(timestamptz, int) from public, anon, authenticated, service_role;

create function public.purge_stale_anonymous(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid;
  n int := 0;
begin
  for v_uid in select public.stale_anonymous_users(p_now, 500) loop
    if (public.user_delete_core(v_uid, 'account_purged') ->> 'scope') = 'none' then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.purge_stale_anonymous(timestamptz) from public, anon, authenticated, service_role;

-- purge_expired_data(0043) + 연결 전·옛 익명 계정 정리
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int; n_push_log int; n_push_runs int; n_tokens int; n_claims int; n_audit int; n_kakao int;
  n_stale int;
begin
  if p_now > now() + interval '1 minute' then raise exception 'future_now'; end if; -- 0043 M1
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
  -- 0057: 연결 전·옛 익명 계정(마지막 활동 + stale_anon_days()). 실패해도 위 파기는 유지
  begin
    n_stale := public.purge_stale_anonymous(p_now);
  exception when others then
    raise warning 'purge_stale_anonymous_failed: %', sqlstate;
    n_stale := -1;
  end;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs,
                            'device_tokens', n_tokens, 'push_claims', n_claims, 'admin_audit', n_audit, 'kakao_unlink_queue', n_kakao,
                            'stale_anonymous', n_stale);
end $$;
