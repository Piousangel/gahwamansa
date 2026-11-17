-- 0017 되돌리기(수동): delete_my_account 를 0008 판(인증 계정은 남김)으로, discard_anonymous_session 삭제
drop function if exists public.discard_anonymous_session();
create or replace function public.delete_my_account() returns jsonb
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
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_family and user_id is not null);
    delete from public.families where id = v_family;
    v_scope := 'family';
  else
    delete from public.device_tokens where user_id = auth.uid();
    delete from public.profiles where id = v_me;
    v_scope := v_role;
  end if;
  return jsonb_build_object('scope', v_scope);
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
