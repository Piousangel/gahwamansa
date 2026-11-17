-- 0019 되돌리기(수동). give_consent·withdraw_consent는 0014 정의로, child_summary는 0012 정의로 다시 만들어야 한다(해당 파일 참고).
drop function if exists public.set_parent_title_for(uuid, text);
drop table if exists public.consent_events;
revoke select (parent_title) on public.profiles from authenticated;
alter table public.profiles drop column if exists parent_title;
