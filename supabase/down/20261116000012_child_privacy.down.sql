-- 0012 되돌리기 (수동 실행). 철회로 지워진 답은 복구되지 않는다.
drop function if exists public.set_parent_title(text);
drop function if exists public.child_summary();
drop function if exists public.withdraw_consent();
drop function if exists public.give_consent(text);
create function public.give_consent() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  update public.profiles set consented_at = coalesce(consented_at, now()) where id = public.my_profile_id();
end $$;
revoke execute on function public.give_consent() from public, anon;
grant execute on function public.give_consent() to authenticated;
drop policy answers_read on public.answers;
create policy answers_read on public.answers for select to authenticated
  using (family_id = public.my_family_id() and (public.my_role() = 'child' or parent_id = public.my_profile_id()));
drop policy sessions_read on public.daily_sessions;
create policy sessions_read on public.daily_sessions for select to authenticated
  using (family_id = public.my_family_id() and (public.my_role() = 'child' or parent_id = public.my_profile_id()));
alter table public.profiles drop column consent_withdrawn_at, drop column consent_version;
alter table public.families drop column parent_title;
