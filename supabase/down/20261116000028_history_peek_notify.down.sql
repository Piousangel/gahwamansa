-- 0028 되돌리기(수동).
-- 순서(리뷰 L7): **먼저** advance_content_cursor(0024)·get_today_content(0010)·redeem_invite_code(0025)·purge_expired_data(0023)·
--   set_parent_title_for(0019) 정의를 해당 파일에서 다시 실행해 아래 컬럼·테이블에 기대지 않게 한 뒤, 이 파일을 실행한다.
drop function if exists public.parent_history(int);
drop function if exists public.peek_invite_code(text);
drop table if exists public.notification_queue;
alter table public.daily_sessions drop column if exists photo_id, drop column if exists question_id, drop column if exists word_id;
