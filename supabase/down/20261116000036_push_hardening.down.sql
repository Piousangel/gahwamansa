-- 0036 되돌리기(수동). 순서: ① Edge Function을 0033 버전(push_daily_targets 사용)으로 되돌려 배포
--   ② register_push_token(0032)·set_push_enabled·my_push_settings·push_daily_targets(0033)·purge_expired_data(0033) 정의를 다시 실행
--   ③ 이 파일. 권한 회수(M1)는 보안 약화라 되돌리지 않는다.
drop function if exists public.push_daily_claim(timestamptz);
drop function if exists public.push_record(text, jsonb, int, timestamptz, text);
-- push_record(0033 4인자 정의)를 0033 파일에서 다시 만들고 service_role에 grant
drop function if exists public.push_daily_eligible(date);
drop table if exists public.push_claims;
alter table public.push_runs drop column if exists note;
alter table public.profiles drop column if exists push_consented_at;
drop index if exists public.device_tokens_token_key;
create index if not exists device_tokens_token_idx on public.device_tokens (token);
