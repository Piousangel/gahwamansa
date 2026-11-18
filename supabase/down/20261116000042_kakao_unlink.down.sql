-- 0042 되돌리기(수동). 순서: ① account_delete_core(0039)·purge_expired_data(0039)·push_kick(0038) 정의를 다시 실행 ② 이 파일.
-- 대기 중인 회원번호가 있으면 먼저 처리(또는 운영 대장에 옮긴 뒤 삭제)한다.
select cron.unschedule('kakao-unlink') where exists (select 1 from cron.job where jobname = 'kakao-unlink');
drop function if exists public.kakao_unlink_kick(timestamptz);
drop function if exists public.kakao_unlink_record(jsonb);
drop function if exists public.kakao_unlink_claim(int, timestamptz);
drop table if exists public.kakao_unlink_queue;
