-- 0054 되돌리기(수동). account_delete_core는 0043, user_delete_core는 0049 정의를 다시 실행한다(이벤트 기록 줄이 빠진다).
-- 이미 남은 account_deleted 서버 기록(식별자 없음)은 지우지 않는다 — events 보관 규칙(14개월 파기 배치)을 따른다.
select 1;
