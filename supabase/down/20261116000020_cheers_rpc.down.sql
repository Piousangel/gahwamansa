-- 0020 되돌리기(수동): 응원 RPC 제거, 자녀 직접 insert 정책(0002) 복구
drop function if exists public.send_cheer(uuid, text);
drop function if exists public.get_my_cheers();
drop function if exists public.mark_cheers_read(uuid[]);
grant insert on public.cheers to authenticated;
create policy cheers_insert on public.cheers for insert to authenticated
  with check (
    public.my_role() = 'child'
    and from_child = public.my_profile_id()
    and family_id = public.my_family_id()
    and exists (select 1 from public.profiles p where p.id = to_parent and p.family_id = public.my_family_id() and p.role = 'parent')
  );
