-- 0039 관리자 삭제·감사 기록·콘텐츠 재고 뷰(로드맵 SV-07, 백오피스 계획 11 §4 빌드 1, 리뷰 BO6·BO8·BO9)
-- (1) 공통 삭제 함수 account_delete_core(profile): delete_my_account(0026) 본문을 그대로 옮긴 내부 함수. 앱 경로와 관리자 경로가 갈라지지 않게 한다.
--     자녀가 남으면 본인만(scope child), 어르신은 본인 기록(parent), 마지막 자녀면 가족 전체 + 어르신 익명 인증 계정(family), 끝으로 대상의 인증 계정 삭제.
-- (2) 웹 삭제 요청 처리(이메일 접수 → 7일 목표·10일 상한, DECISIONS 11-17): 서비스 역할 전용
--     admin_delete_account(profile, 사유, 처리자) / admin_delete_answers(profile, 사유, 처리자) — "답·참여 기록만" 약속(답 + 코스 기록, 연결·동의는 둠).
--     빌드 1은 관리자 로그인(admin_users·is_admin·aal2)이 없어 운영자가 Studio SQL·스크립트(서비스 역할)로 부른다 → 함수가 감사 행을 직접 남긴다(리뷰 BO 보안 지적).
-- (3) admin_audit: 누가·언제·무엇·대상·사유. 대상이 지워져도 남도록 FK 없음. 앱 접근 불가, 수정·삭제는 트리거가 막는다
--     (postgres·서비스 역할은 기술적으로 트리거를 끌 수 있으므로 "삭제 불가"가 아니라 "변경 감지·차단"). 보관 1년(안전성 확보조치 접속기록), 파기 배치만 예외.
-- (4) content_runway 뷰: 가장 앞선 어르신 커서 뒤로 남은 새 콘텐츠 날 수(06시 루틴 7일 미만 경보, 계획 11 §4). 서비스 역할만.

create table public.admin_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  operator text not null check (char_length(operator) between 1 and 60),
  action text not null check (action in ('delete_account', 'delete_answers', 'content_publish', 'content_retire')), -- content_*는 SV-08 콘텐츠 스크립트
  target_profile uuid,
  target_family uuid,
  reason text not null check (char_length(reason) between 1 and 200),
  detail jsonb not null default '{}'::jsonb
);
create index on public.admin_audit (at);
alter table public.admin_audit enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.admin_audit from public, anon, authenticated;
revoke all on sequence public.admin_audit_id_seq from public, anon, authenticated;

create function public.admin_audit_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if coalesce(current_setting('bumo.allow_audit_purge', true), '') <> 'on' then
    raise exception 'audit_immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger admin_audit_no_update before update or delete on public.admin_audit
  for each row execute function public.admin_audit_guard();
create trigger admin_audit_no_truncate before truncate on public.admin_audit
  for each statement execute function public.admin_audit_guard();

-- 내부 공통 삭제(0026 delete_my_account 본문). 반환 {scope} 또는 null(없는 프로필)
create function public.account_delete_core(p_profile uuid) returns jsonb
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
    delete from auth.users where id = v_p.user_id;
  end if;
  return jsonb_build_object('scope', v_scope);
end $$;
revoke execute on function public.account_delete_core(uuid) from public, anon, authenticated;

-- 앱: 본인 삭제(동작 그대로, 공통 함수 사용)
create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
begin
  if v_me is null then raise exception 'no_profile'; end if;
  return public.account_delete_core(v_me);
end $$;

create function public.admin_check_args(p_reason text, p_operator text) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_reason is null or btrim(p_reason) = '' then raise exception 'reason_required'; end if;
  if p_operator is null or btrim(p_operator) = '' then raise exception 'operator_required'; end if;
end $$;
revoke execute on function public.admin_check_args(text, text) from public, anon, authenticated;

-- 서비스 역할: 계정 삭제(웹 요청). {ok, scope} | {ok:false, reason:'not_found'}
create function public.admin_delete_account(p_profile uuid, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid;
  v_role text;
  v_res jsonb;
begin
  perform public.admin_check_args(p_reason, p_operator);
  select family_id, role into v_family, v_role from public.profiles where id = p_profile;
  if v_family is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  v_res := public.account_delete_core(p_profile);
  insert into public.admin_audit (operator, action, target_profile, target_family, reason, detail)
  values (btrim(p_operator), 'delete_account', p_profile, v_family, btrim(p_reason), jsonb_build_object('role', v_role) || v_res);
  return jsonb_build_object('ok', true) || v_res;
end $$;

-- 서비스 역할: 어르신의 답·코스 기록만 삭제(연결·동의 유지). {ok, answers, sessions} | {ok:false, reason:'not_found'|'not_parent'}
create function public.admin_delete_answers(p_profile uuid, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
  v_answers int;
  v_sessions int;
begin
  perform public.admin_check_args(p_reason, p_operator);
  select * into v_p from public.profiles where id = p_profile;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_p.role <> 'parent' then return jsonb_build_object('ok', false, 'reason', 'not_parent'); end if;
  perform 1 from public.profiles where id = p_profile for update; -- 저장·철회와 줄 세움(0014와 같은 잠금)
  delete from public.answers where parent_id = p_profile;
  get diagnostics v_answers = row_count;
  delete from public.daily_sessions where parent_id = p_profile;
  get diagnostics v_sessions = row_count;
  insert into public.admin_audit (operator, action, target_profile, target_family, reason, detail)
  values (btrim(p_operator), 'delete_answers', p_profile, v_p.family_id, btrim(p_reason), jsonb_build_object('answers', v_answers, 'sessions', v_sessions));
  return jsonb_build_object('ok', true, 'answers', v_answers, 'sessions', v_sessions);
end $$;

revoke execute on function public.admin_delete_account(uuid, text, text), public.admin_delete_answers(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_delete_account(uuid, text, text), public.admin_delete_answers(uuid, text, text) to service_role;

create view public.content_runway with (security_invoker = true) as
  with a as (
    select p.day_index from public.content_photos p join public.content_questions q using (day_index)
     where p.retired_at is null and q.retired_at is null
  ), c as (
    select max(pr.content_seq) as m
      from public.profiles pr join public.families f on f.id = pr.family_id
     where pr.role = 'parent' and not f.is_review and pr.content_seq is not null
  )
  select (select count(*) from a) as active_days,
         c.m as max_cursor,
         (select count(*) from a where a.day_index > coalesce(c.m, 0)) as remaining_new_days
    from c;
revoke all on public.content_runway from public, anon, authenticated;
grant select on public.content_runway to service_role;

-- purge_expired_data(0036) + 감사 행 1년
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int; n_push_log int; n_push_runs int; n_tokens int; n_claims int; n_audit int;
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
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs,
                            'device_tokens', n_tokens, 'push_claims', n_claims, 'admin_audit', n_audit);
end $$;
