-- 0027 되돌리기(수동). child_summary는 0021 정의로 다시 만들어야 한다(latest.starter 제거).
alter table public.content_questions drop column if exists starter_a, drop column if exists starter_b;
