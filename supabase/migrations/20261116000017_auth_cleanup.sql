-- 0017 계정 지우기 때 인증 계정까지 삭제 + 소셜 로그인 직전 고아 익명 사용자 정리 (보안 검토 2026-11-17 #1·#4)
-- 방식 비교(근거는 docs/team/dev-app-notes.md "탈퇴 시 인증 계정 삭제"):
--   (A) 이 RPC 안에서 auth.users 를 지운다(security definer, 호출한 본인만) ← 채택
--       앱 데이터 삭제와 같은 트랜잭션이라 "데이터는 지웠는데 인증 계정은 남음" 상태가 생기지 않고, 서비스 키·Edge Function 이 필요 없다.
--   (B) Edge Function(service_role)에서 auth.admin.deleteUser: 별도 배포·시크릿이 필요하고, 네트워크 실패 시 반쪽 상태가 생길 수 있어 보류.
-- auth.users 를 지우면 auth.identities(소셜 이메일·이름·회원번호 등)·세션·리프레시 토큰이 auth 스키마의 cascade 로 함께 지워진다.
-- 원격(호스팅) 프로젝트에서 함수 소유자(postgres)의 auth.users 삭제 권한은 배포 때 확인해야 한다(로컬은 pgTAP 로 확인).

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_role text := public.my_role();
  v_scope text;
begin
  if v_me is null then
    raise exception 'no_profile';
  end if;

  if v_role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_family and role = 'child' and id <> v_me
  ) then
    -- 마지막 자녀: 가족 전체(어르신 기록 포함)를 지운다. 가족 구성원의 푸시 토큰도 함께 정리.
    -- (어르신의 인증 계정은 어르신 기기의 것이라 여기서 지우지 않는다. 그 기기는 프로필 없는 익명이 된다)
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_family and user_id is not null);
    delete from public.families where id = v_family;
    v_scope := 'family';
  else
    delete from public.device_tokens where user_id = v_uid;
    delete from public.profiles where id = v_me;
    v_scope := v_role;
  end if;

  -- 호출한 본인의 인증 계정(소셜 식별 정보 포함)까지 삭제. 다시 로그인하면 새 사용자로 시작한다.
  delete from auth.users where id = v_uid;

  return jsonb_build_object('scope', v_scope);
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 소셜 로그인 직전: 이 기기의 익명 세션이 "프로필 없는 익명 사용자"(미연결 열람 등)면 그 인증 계정을 지운다.
-- 연결된 어르신(프로필 있음)이나 익명이 아닌 사용자는 건드리지 않는다(discarded=false).
create or replace function public.discard_anonymous_session() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
     or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or exists (select 1 from public.profiles where user_id = v_uid) then
    return jsonb_build_object('discarded', false);
  end if;
  delete from public.device_tokens where user_id = v_uid;
  delete from auth.users where id = v_uid and is_anonymous;
  return jsonb_build_object('discarded', true);
end $$;

revoke execute on function public.discard_anonymous_session() from public, anon;
grant execute on function public.discard_anonymous_session() to authenticated;
