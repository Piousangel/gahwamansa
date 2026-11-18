-- 0047 되돌리기(수동). 권한 회수(push_kick·큐 select)는 되돌리지 않는다. display_name은 되살리지 않는다(쓰는 곳 0).
-- admin_check_args는 0043 정의(pii 검사 없음)로 다시 실행할 수 있다.
drop function if exists public.admin_kakao_unlink_retry(bigint, text, text);
drop function if exists public.admin_kakao_unlink_resolve(bigint, text, text);
drop view if exists public.kakao_unlink_gave_up;
