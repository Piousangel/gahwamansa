-- 0052 되돌리기(수동). save_answer는 0014, push_record는 0036, push_events_claim·push_events_kick은 0041 정의를 먼저 다시 실행한다.
-- 종류 제약(notification_queue·push_copy·push_log·push_claims)은 parent_first_answer 행을 지운 뒤에만 이전 목록으로 되돌릴 수 있다
-- (push_log는 발송 기록이므로 보관 기간 동안 지우지 않는다 → push_log 제약은 되돌리지 않는다).
-- 주의(리뷰 PR #48 L3): first_answer_notices를 지우면 "평생 1회" 기록이 사라진다. 되돌리기 전에 이 표를 내보내 두고,
-- 0052를 다시 올릴 때는 마이그레이션의 백필(first_answer_backfill)이 **다시 돈다** — 백필은 "자녀 프로필 뒤 답이 있는 가족"만 skipped로 넣으므로
-- 이미 알림을 받은 자녀(sent)·지나간 자녀(no_token·failed·not_reachable)의 기록은 내보낸 파일에서 복원해야 두 번 가지 않는다.
delete from public.notification_queue where kind = 'parent_first_answer';
delete from public.push_copy where kind = 'parent_first_answer';
alter table public.push_copy drop constraint if exists push_copy_first_answer_vars;
drop function if exists public.first_answer_backfill();
drop table if exists public.first_answer_notices;
