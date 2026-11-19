-- 0052 되돌리기(수동). save_answer는 0014, push_record는 0036, push_events_claim·push_events_kick은 0041 정의를 먼저 다시 실행한다.
-- 종류 제약(notification_queue·push_copy·push_log·push_claims)은 parent_first_answer 행을 지운 뒤에만 이전 목록으로 되돌릴 수 있다
-- (push_log는 발송 기록이므로 보관 기간 동안 지우지 않는다 → push_log 제약은 되돌리지 않는다).
delete from public.notification_queue where kind = 'parent_first_answer';
delete from public.push_copy where kind = 'parent_first_answer';
drop table if exists public.first_answer_notices;
