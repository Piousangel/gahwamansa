-- 0027 되돌리기(수동). issue_invite_code·redeem_invite_code는 0018 정의로 다시 만들어야 한다.
drop function if exists public.admin_create_review_family(uuid[]);
drop trigger if exists invite_codes_reusable_guard on public.invite_codes;
drop function if exists public.invite_codes_reusable_guard();
delete from public.invite_codes where reusable;
alter table public.invite_codes drop column if exists reusable;
alter table public.families drop column if exists is_review;
