-- 0050 되돌리기(수동). child_summary는 0041 정의, child_answer_history는 0021 정의를 **먼저** 다시 실행한 뒤(내부 함수 의존 해제) 아래를 실행한다.
-- 0041의 child_summary는 이미 `create or replace`라 그대로 붙여 넣으면 되지만, 0021의 child_answer_history는 `create function`이라
-- 그대로 실행하면 already exists로 실패한다 → 첫 줄을 `create or replace function public.child_answer_history()`로 바꿔 실행한다(grant·revoke 줄은 다시 실행할 필요 없음).
drop function if exists public.parent_preview_child_view();
drop function if exists public.family_child_history(uuid, uuid);
drop function if exists public.family_child_summary(uuid, uuid);
