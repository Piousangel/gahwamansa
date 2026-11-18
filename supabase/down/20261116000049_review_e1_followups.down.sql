-- 0049 되돌리기(수동). 뷰 쓰기 권한 회수(M1)는 되돌리지 않는다(되돌리면 감사 우회가 다시 열림).
-- admin_check_args는 0047 정의, push_text_clean은 0048 정의, delete_my_account는 0039 정의, delete_scope_preview는 0011 정의를 다시 실행한 뒤
-- push_copy_no_ads·cheer_texts_no_ads 제약을 다시 만든다. admin_audit_action_check는 이전 목록으로 되돌리지 않는다
-- (delete_user 감사 행이 남아 있으면 되돌린 제약이 실패한다 — 1년 보관 행은 지우지 않는다).
drop function if exists public.admin_delete_user(uuid, text, text);
drop function if exists public.user_delete_core(uuid);
