-- 0028 마지막 자녀가 지워 가족 전체를 지울 때 어르신 기기의 익명 인증 계정도 지운다
-- 근거: DECISIONS 2026-11-17 정책 문서 v2 리드 결정 "공백 처리". 0017은 어르신 계정을 남겨 "프로필 없는 익명"이 고아로 남았다.
-- 방식: 0017과 같이 같은 트랜잭션 안에서 auth.users 삭제(security definer). 익명(is_anonymous) 계정만 지운다.
-- 어르신 기기는 다음 실행 때 세션이 무효가 되어 앱이 새 익명 로그인 → 첫 화면/미연결 열람으로 간다(앱 동작은 앱 줄 확인).

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_role text := public.my_role();
  v_scope text;
  v_parent_uids uuid[];
begin
  if v_me is null then
    raise exception 'no_profile';
  end if;

  if v_role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_family and role = 'child' and id <> v_me
  ) then
    -- 마지막 자녀: 가족 전체(어르신 기록 포함)를 지운다. 가족 구성원의 푸시 토큰과 어르신 익명 계정도 함께 정리.
    select coalesce(array_agg(user_id), '{}') into v_parent_uids
      from public.profiles where family_id = v_family and role = 'parent' and user_id is not null;
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_family and user_id is not null);
    delete from public.families where id = v_family;
    delete from auth.users where id = any (v_parent_uids) and is_anonymous;
    v_scope := 'family';
  else
    delete from public.device_tokens where user_id = v_uid;
    delete from public.profiles where id = v_me;
    v_scope := v_role;
  end if;

  delete from auth.users where id = v_uid;

  return jsonb_build_object('scope', v_scope);
end $$;
