-- 0033 되돌리기(수동). 순서: ① cron 해제 ② purge_expired_data를 0028 정의로 다시 실행 ③ 이 파일 나머지.
select cron.unschedule('push-daily') where exists (select 1 from cron.job where jobname = 'push-daily');
drop function if exists public.push_daily_kick();
drop function if exists public.push_daily_targets(timestamptz);
drop function if exists public.push_record(text, jsonb, int, timestamptz);
drop function if exists public.set_push_enabled(boolean);
drop function if exists public.my_push_settings();
drop table if exists public.push_runs;
drop table if exists public.push_log;
drop table if exists public.push_copy;
alter table public.profiles drop column if exists push_enabled;
-- pg_net 확장은 다른 기능이 쓸 수 있어 남긴다.
