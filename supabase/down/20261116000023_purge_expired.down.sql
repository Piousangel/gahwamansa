-- 0023 되돌리기(수동). pg_cron 확장 자체는 다른 배치가 쓸 수 있어 남긴다.
select cron.unschedule('purge-expired-data') where exists (select 1 from cron.job where jobname = 'purge-expired-data');
drop function if exists public.purge_expired_data(timestamptz);
