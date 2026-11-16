-- 되돌리기: 20261116000005_rpc_session.sql (수동 실행용)
drop function if exists public.my_day_index();
drop function if exists public.record_session_step(text, int);
drop function if exists public.parent_streak(uuid, date);
drop function if exists public.kst_today();
