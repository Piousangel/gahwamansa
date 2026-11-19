-- 0050 되돌리기(수동). child_summary는 0041 정의, child_answer_history는 0021 정의를 **먼저** 다시 실행한 뒤(내부 함수 의존 해제) 아래를 실행한다.
drop function if exists public.parent_preview_child_view();
drop function if exists public.family_child_history(uuid, uuid);
drop function if exists public.family_child_summary(uuid, uuid);
