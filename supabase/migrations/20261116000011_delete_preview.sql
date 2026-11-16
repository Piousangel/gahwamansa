-- 0011 삭제 범위 사전 조회: 앱이 확인 화면에서 정확한 경고를 보여 주기 위함(삭제는 하지 않음)
create function public.delete_scope_preview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_role text := public.my_role();
begin
  if v_me is null then raise exception 'no_profile'; end if;
  if v_role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_family and role = 'child' and id <> v_me
  ) then
    return jsonb_build_object('scope', 'family');
  end if;
  return jsonb_build_object('scope', v_role);
end $$;
revoke execute on function public.delete_scope_preview() from public, anon;
grant execute on function public.delete_scope_preview() to authenticated;
