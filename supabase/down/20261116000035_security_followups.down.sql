-- 0035 되돌리기(수동). 순서: ① set_parent_title(0012)·set_parent_title_for(0028) 정의를 다시 실행 ② 이 파일.
comment on function public.set_parent_title(text) is null;
drop function if exists public.give_consent(text);
-- give_consent는 0019 정의(default 'v1')로 다시 만든 뒤 권한을 준다:
--   (0019 파일의 create or replace function public.give_consent(p_version text default 'v1') ... 실행)
--   revoke execute on function public.give_consent(text) from public, anon; grant execute on function public.give_consent(text) to authenticated;
drop function if exists public.parent_titles();
grant insert, update, delete, truncate on public.content_photos, public.content_questions to authenticated;
