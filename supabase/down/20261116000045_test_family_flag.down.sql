-- 0045 되돌리기(수동). families 직접 UPDATE 회수는 되돌리지 않는다(쓰기는 definer 함수만).
drop function if exists public.admin_set_test_family(uuid, boolean, text, text);
alter table public.families drop column if exists is_test;
-- admin_audit action 목록은 test_family_mark 행이 남아 있으면 줄일 수 없다(감사 보존).
