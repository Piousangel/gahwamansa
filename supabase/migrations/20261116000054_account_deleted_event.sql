-- 0054 측정 이벤트 account_deleted를 서버가 기록(DECISIONS 11-19 '측정', AC-05 후속). 앱은 삭제 뒤 사용자가 없어 보낼 수 없다.
-- 삭제 공통 함수 두 곳에서 한 줄씩 남긴다:
--   account_delete_core(0043) — 앱 delete_my_account(프로필 있음)·관리자 admin_delete_account. scope child|parent|family, 역할 = 지운 사람의 역할.
--   user_delete_core(0049)    — 앱 delete_my_account(연결 전)·관리자 admin_delete_user. scope none, 역할 none.
-- 개인 식별자 없음: family_id·profile_id·device_key 모두 null, props는 {scope, role}만. (가족·프로필은 지워지므로 남길 수도 없다.)
-- 심사 가족(is_review)의 삭제는 기록하지 않는다(심사 정리가 지표에 섞이지 않게).
-- (리뷰 PR #66) L1 측정 기록이 실패해도 계정 삭제(법적 의무)는 막지 않는다: 기록을 예외 블록으로 감싸 실패하면 warning만(SQLSTATE만, 값 없음).
--   L2 기록 시각은 시 단위로 자른다(date_trunc('hour')) — 같은 시각의 다른 이벤트·감사 행과 이어 붙여 사람을 짐작하지 못하게.
-- 앱이 log_event로 보내는 account_deleted(0022 이름 목록)는 그대로 두지만 삭제 뒤라 실패한다. 지표는 device_key is null인 서버 기록을 센다.
-- props 키 scope·role은 서버 전용(log_event의 event_prop_ok 목록에는 넣지 않는다 — 앱 계약 events.ts와 같은 목록 유지).

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

create or replace function public.user_delete_core(p_user uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from auth.users where id = p_user for update;
  if not found then return null; end if;
  if exists (select 1 from public.profiles where user_id = p_user) then return jsonb_build_object('scope', 'has_profile'); end if;
  delete from public.device_tokens where user_id = p_user;
  insert into public.kakao_unlink_queue (kakao_user_id)
  select provider_id from auth.identities where user_id = p_user and provider = 'kakao';
  delete from auth.users where id = p_user;
  -- 0054: 식별자 없는 측정 기록(연결 전 계정은 가족이 없어 심사 가족일 수 없음)
  begin
    insert into public.events (ts, family_id, profile_id, device_key, actor_role, name, props)
    values (date_trunc('hour', now()), null, null, null, 'none', 'account_deleted', jsonb_build_object('scope', 'none', 'role', 'none'));
  exception when others then
    raise warning 'account_deleted_event_failed: %', sqlstate; -- 측정 실패는 삭제를 막지 않는다
  end;
  return jsonb_build_object('scope', 'none');
end $$;
