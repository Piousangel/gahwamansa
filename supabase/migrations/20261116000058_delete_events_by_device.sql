-- 0058 계정을 지우면 그 사람의 이용 기록(events)도 함께 지운다(리드 결정·법률 지적, 방침 4절 "계정을 지우면 그 기록도 함께 지웁니다").
-- 문제: events는 profile_id·family_id FK cascade로 가족·프로필 기록은 지워지지만, 프로필이 없을 때(연결 전·연결 뒤 앱 시작 등) 쌓인 행은
--   profile_id·family_id가 null이고 device_key(= 인증 uid의 sha256, 0022)만 있어 계정을 지워도 남았다.
-- 고침: 삭제 공통 함수 두 곳에서 인증 계정을 지우기 직전에 `device_key = event_device_key(uid)`인 행을 지운다.
--   account_delete_core(0054): 대상 본인 + 가족 전체 삭제 때 함께 지워지는 어르신 익명 계정들. 앱 delete_my_account·admin_delete_account.
--   user_delete_core(uuid, text)(0057): 연결 전 계정 — 앱 delete_my_account·admin_delete_user(1인자 판이 이 함수를 부름)와 0057 자동 정리(account_purged) 모두 같은 함수.
-- 탈퇴·정리 기록(account_deleted·account_purged)은 device_key가 null(식별자 없음)이라 지워지지 않고 남는다(의도).
-- 다른 사람의 이벤트는 device_key가 달라 남는다.

create or replace function public.account_delete_core(p_profile uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
  v_scope text;
  v_parent_uids uuid[];
  v_review boolean;
begin
  select * into v_p from public.profiles where id = p_profile;
  if not found then return null; end if;
  perform 1 from public.families where id = v_p.family_id for update; -- 0043 L2: 같은 가족 동시 삭제를 줄 세움(마지막 자녀 판단 경쟁)
  select f.is_review into v_review from public.families f where f.id = v_p.family_id;

  if v_p.role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_p.family_id and role = 'child' and id <> v_p.id
  ) then
    select coalesce(array_agg(user_id), '{}') into v_parent_uids
      from public.profiles where family_id = v_p.family_id and role = 'parent' and user_id is not null;
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_p.family_id and user_id is not null);
    delete from public.families where id = v_p.family_id;
    delete from public.events where device_key in (select public.event_device_key(u.id) from auth.users u where u.id = any (v_parent_uids) and u.is_anonymous); -- 0058: 지워지는 어르신 익명 계정의 연결 전 이용 기록
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
    delete from public.events where device_key = public.event_device_key(v_p.user_id); -- 0058: 프로필 없이 쌓인 이용 기록(연결 전 포함)
    delete from auth.users where id = v_p.user_id;
  end if;

  -- 0054: 식별자 없는 측정 기록(심사 가족 제외)
  if not coalesce(v_review, false) then
    begin
      insert into public.events (ts, family_id, profile_id, device_key, actor_role, name, props)
      values (date_trunc('hour', now()), null, null, null, v_p.role, 'account_deleted', jsonb_build_object('scope', v_scope, 'role', v_p.role));
    exception when others then
      raise warning 'account_deleted_event_failed: %', sqlstate; -- 측정 실패는 삭제를 막지 않는다
    end;
  end if;
  return jsonb_build_object('scope', v_scope);
end $$;

create or replace function public.user_delete_core(p_user uuid, p_event text) returns jsonb
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
  delete from public.events where device_key = public.event_device_key(p_user); -- 0058: 프로필 없이 쌓인 이용 기록
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
