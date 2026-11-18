-- 0039 되돌리기(수동). 순서: ① delete_my_account(0026)·purge_expired_data(0036) 정의를 다시 실행 ② 이 파일.
-- 감사 기록(admin_audit)은 1년 보관 의무가 있으므로 표를 지우기 전에 내보내 보관한다.
drop view if exists public.content_runway;
drop function if exists public.admin_delete_answers(uuid, text, text);
drop function if exists public.admin_delete_account(uuid, text, text);
drop function if exists public.admin_check_args(text, text);
drop function if exists public.account_delete_core(uuid);
drop table if exists public.admin_audit;
drop function if exists public.admin_audit_guard();
