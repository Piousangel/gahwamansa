-- 0014 되돌리기(수동). save_answer는 0009 정의로, give_consent/withdraw_consent는 0012 정의로 다시 만들어야 한다(해당 파일 참고).
grant select on public.profiles to authenticated;
alter table public.profiles add column if not exists consent_withdrawn_at timestamptz;
drop policy cheers_read on public.cheers;
create policy cheers_read on public.cheers for select to authenticated
  using (family_id = public.my_family_id() and (public.my_role() = 'child' or to_parent = public.my_profile_id()));
