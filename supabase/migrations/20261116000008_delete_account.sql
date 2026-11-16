-- 0008 계정·데이터 삭제 + 외래키 정리
-- 이유(코드 리뷰 지적): used_by, created_by 등 외래키에 ON DELETE 동작이 없어 auth 사용자 삭제와 프로필 삭제가 막혔다.
-- 정책 결정(사용자 승인): 어르신 삭제=본인 기록, 자녀 삭제=본인, 마지막 자녀 삭제=가족 전체(어르신 기록 포함).

alter table public.invite_codes drop constraint invite_codes_used_by_fkey,
  add constraint invite_codes_used_by_fkey foreign key (used_by) references auth.users(id) on delete set null;
alter table public.invite_codes drop constraint invite_codes_created_by_fkey,
  add constraint invite_codes_created_by_fkey foreign key (created_by) references public.profiles(id) on delete cascade;
alter table public.invite_codes drop constraint invite_codes_target_profile_id_fkey,
  add constraint invite_codes_target_profile_id_fkey foreign key (target_profile_id) references public.profiles(id) on delete cascade;
alter table public.cheers drop constraint cheers_from_child_fkey,
  add constraint cheers_from_child_fkey foreign key (from_child) references public.profiles(id) on delete cascade;
alter table public.cheers drop constraint cheers_to_parent_fkey,
  add constraint cheers_to_parent_fkey foreign key (to_parent) references public.profiles(id) on delete cascade;
-- 가족을 만든 인증 사용자가 삭제돼도 가족(다른 자녀·어르신)은 남아야 한다.
alter table public.families alter column created_by drop not null;
alter table public.families drop constraint families_created_by_fkey,
  add constraint families_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

-- 호출한 사용자 본인의 앱 데이터를 삭제한다. 인증 계정(auth.users) 자체는 앱이 이어서 로그아웃한다.
-- 반환 scope: 'parent'(본인 기록) | 'child'(본인) | 'family'(마지막 자녀라서 가족 전체)
create function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
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
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_family and user_id is not null);
    delete from public.families where id = v_family; -- profiles, answers, daily_sessions, cheers, invite_codes, entitlements가 cascade
    v_scope := 'family';
  else
    delete from public.device_tokens where user_id = auth.uid();
    delete from public.profiles where id = v_me; -- answers, daily_sessions, cheers, invite_codes가 cascade
    v_scope := v_role;
  end if;

  return jsonb_build_object('scope', v_scope);
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
