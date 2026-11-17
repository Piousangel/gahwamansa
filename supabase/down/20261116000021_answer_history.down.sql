-- 0021 되돌리기(수동). child_summary는 0019 정의로 다시 만들어야 한다(connected 키 제거).
drop function if exists public.child_answer_history();
drop function if exists public.choice_pair_prompt(text, text);
