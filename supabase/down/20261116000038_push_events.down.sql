-- 0038 되돌리기(수동). 순서: ① Edge Function push-events 배포 중지·push-daily를 0037 버전으로
--   ② push_daily_claim을 0036 정의로 다시 실행(대상별 문구 없는 버전) ③ 이 파일.
select cron.unschedule('push-events') where exists (select 1 from cron.job where jobname = 'push-events');
drop function if exists public.push_events_kick(timestamptz);
drop function if exists public.push_kick(text);
drop function if exists public.push_events_claim(timestamptz);
drop function if exists public.push_reachable(uuid);
drop function if exists public.push_channel(text);
drop function if exists public.push_render(text, jsonb, text);
drop index if exists public.notification_queue_unsent_idx;
drop index if exists public.cheers_unnotified_idx;
alter table public.cheers drop column if exists notified_at;
drop table if exists public.cheer_texts;
alter table public.push_copy drop column if exists body_fallback, drop column if exists body_many;
