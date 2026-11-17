-- 0031 되돌리기(수동). 보안 약화이므로 실제로 되돌릴 일은 없어야 한다.
grant execute on function public.my_profile_id(), public.my_family_id(), public.my_role(), public.my_consented() to public, anon;
alter function public.kst_today() reset search_path;
drop policy tokens_own on public.device_tokens;
create policy tokens_own on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
