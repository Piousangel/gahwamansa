-- 0057 연결 전·옛 익명 계정 자동 정리(법률 PR #154, 법 제21조 파기 원칙, 방침 v2.5 4·10절·삭제 안내 2절 자리표시 P21, dev-server-notes §19 ①).
-- 대상: 익명(auth.users.is_anonymous) + 프로필 없음(가족과 한 번도 연결하지 않은 어르신 기기, 또는 재연결로 프로필이 새 기기로 옮겨 가 비워진 옛 익명 계정)
--       + 마지막 활동이 정리 기간(stale_anon_days() = 90일, 오너 확정 DECISIONS 11-20 — 바꿀 때는 이 함수 한 곳과 방침 4절·삭제 안내 2절을 함께) 넘음.
--   마지막 활동 = 가입·마지막 로그인·사용자 행 갱신·세션 갱신·리프레시 토큰 갱신 중 가장 늦은 것(앱을 열면 토큰 갱신으로 세션이 갱신된다).
--   연결된 어르신(프로필 있음)·자녀(소셜 계정, 익명 아님)는 대상이 아니다.
-- 지울 범위: 앱 delete_my_account의 연결 전 경로와 같은 공통 함수(user_delete_core) — 토큰, 카카오 해제 큐(익명은 없음), 인증 계정 → 약관 확인 기록(terms_agreements)·
--   identities·세션 cascade. 기록: 식별자 없는 측정 행 account_purged(props {scope:'stale_anonymous'}, 시 단위 시각) — 탈퇴(account_deleted)와 섞이지 않게 이름을 나눈다.
-- 실행: 기존 파기 배치 purge_expired_data(cron purge-expired-data, 매일 00:10 KST)의 한 단계. 한 번에 최대 200명.
--   이 단계가 실패해도(예: 원격에서 auth 표 권한 문제) 다른 파기는 계속한다(예외 블록, warning). 결과 키 stale_anonymous(-1 = 이 단계 전체 실패).
--   (리뷰 PR #157 M1) 한 명씩 예외 블록으로 감싸 실패한 사람만 건너뛴다(결과 키 stale_anonymous_failed, warning SQLSTATE만).
--   실패한 사람은 stale_purge_failures에 횟수를 남기고 다음 실행의 정렬에서 뒤로 보내 맨 앞을 막지 않는다.
--   (L1) 삭제 직전에 사용자 행을 잠근 채 마지막 활동·프로필을 다시 본다. (L2) 세션 refreshed_at도 활동에 넣는다. (L3) 상수 함수도 서비스 역할 revoke.
--   06시 점검(§14)은 전날 account_purged 수, 실패 건수(stale_purge_failures)를 본다.
--   (두 번째 리뷰) L1 한 번에 최대 200명(사람당 서브트랜잭션 2개 — 바깥 사용자 블록 + 측정 기록 블록. 측정 블록은 "측정 실패해도 삭제"를 위해 유지하고 상한을 낮춘다).
--   L2 실패 기록은 마지막 실패 30일 뒤 지운다(식별자 행이 기한 없이 남지 않게).

create function public.stale_anon_days() returns int
language sql immutable set search_path = ''
as $$ select 90 $$; -- 정리 기간(일, 오너 확정 11-20). 방침·삭제 안내의 {연결 전 계정 자동 정리 기간} = 90일(P21)
revoke execute on function public.stale_anon_days() from public, anon, authenticated, service_role;

-- 실패 기록(M1): 정리 중 예외가 난 사용자. 인증 계정이 지워지면 함께 지워진다. 앱·anon·서비스 역할 접근 불가.
create table public.stale_purge_failures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failures int not null default 1,
  last_failed_at timestamptz not null default now(),
  last_sqlstate text
);
alter table public.stale_purge_failures enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.stale_purge_failures from public, anon, authenticated, service_role;

-- 마지막 활동: 가입·로그인·사용자 갱신·세션(생성·갱신·refreshed_at)·리프레시 토큰 중 가장 늦은 것
-- refreshed_at은 GoTrue에서 timestamp(시간대 없음, UTC 값) — ::timestamp 후 UTC로 읽어 열 형식이 timestamptz로 바뀌어도 같은 값
create function public.anon_last_activity(p_user uuid) returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select greatest(u.created_at, u.last_sign_in_at, u.updated_at,
                  (select max(greatest(s.created_at, s.updated_at, s.refreshed_at::timestamp at time zone 'UTC')) from auth.sessions s where s.user_id = u.id),
                  (select max(greatest(r.created_at, r.updated_at)) from auth.refresh_tokens r where r.user_id = u.id::text))
    from auth.users u where u.id = p_user
$$;
revoke execute on function public.anon_last_activity(uuid) from public, anon, authenticated, service_role;

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

-- 정리 대상(읽기 전용, 테스트·점검용): 프로필 없는 익명 + 마지막 활동이 기준 시각 - 정리 기간보다 이름.
-- 정렬: 실패 횟수가 적은 사람 먼저(실패한 사람이 맨 앞을 막지 않게, M1), 그다음 오래된 가입 순.
create function public.stale_anonymous_users(p_now timestamptz default now(), p_limit int default 200) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select u.id
    from auth.users u
    left join public.stale_purge_failures f on f.user_id = u.id
   where u.is_anonymous
     and not exists (select 1 from public.profiles p where p.user_id = u.id)
     and public.anon_last_activity(u.id) < p_now - make_interval(days => public.stale_anon_days())
   order by coalesce(f.failures, 0), u.created_at
   limit greatest(coalesce(p_limit, 0), 0)
$$;
revoke execute on function public.stale_anonymous_users(timestamptz, int) from public, anon, authenticated, service_role;

-- 한 명씩: 잠근 뒤 다시 확인(L1) → 삭제. 실패는 그 사람만 건너뛰고 기록(M1). {purged, failed}
create function public.purge_stale_anonymous(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_cut timestamptz := p_now - make_interval(days => public.stale_anon_days());
  n int := 0;
  n_failed int := 0;
begin
  for v_uid in select public.stale_anonymous_users(p_now, 200) loop
    begin
      perform 1 from auth.users where id = v_uid and is_anonymous for update;
      if found and public.anon_last_activity(v_uid) < v_cut
         and (public.user_delete_core(v_uid, 'account_purged') ->> 'scope') = 'none' then
        n := n + 1;
      end if;
    exception when others then
      n_failed := n_failed + 1;
      raise warning 'stale_anonymous_user_failed: %', sqlstate; -- 사용자 id는 남기지 않는다
      insert into public.stale_purge_failures as f (user_id, last_sqlstate) values (v_uid, sqlstate)
      on conflict (user_id) do update set failures = f.failures + 1, last_failed_at = now(), last_sqlstate = excluded.last_sqlstate;
    end;
  end loop;
  delete from public.stale_purge_failures where last_failed_at < p_now - interval '30 days'; -- L2: 실패 기록 30일 보관
  return jsonb_build_object('purged', n, 'failed', n_failed);
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
  n_stale_failed int;
  v_r jsonb;
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
    v_r := public.purge_stale_anonymous(p_now);
    n_stale := (v_r ->> 'purged')::int;
    n_stale_failed := (v_r ->> 'failed')::int;
  exception when others then
    raise warning 'purge_stale_anonymous_failed: %', sqlstate;
    n_stale := -1;
    n_stale_failed := null;
  end;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs,
                            'device_tokens', n_tokens, 'push_claims', n_claims, 'admin_audit', n_audit, 'kakao_unlink_queue', n_kakao,
                            'stale_anonymous', n_stale, 'stale_anonymous_failed', n_stale_failed);
end $$;
