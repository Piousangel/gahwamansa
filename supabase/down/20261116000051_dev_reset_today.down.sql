-- 0051 되돌리기(수동). admin_audit_action_check는 이전 목록으로 되돌리지 않는다(dev_reset_today 감사 행이 1년 보관되므로 되돌린 제약이 실패함).
drop function if exists public.dev_reset_today();
drop function if exists public.server_flag_seed_local(text);
drop function if exists public.server_flag(text);
drop table if exists public.server_flags;
