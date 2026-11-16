-- 되돌리기: 0009. 함수는 0004/0006/0007/0003 정의로 복원해야 하므로 해당 down 후 up 파일을 다시 적용한다(수동).
-- answers 이력 제약은 중복 행이 없을 때만 원복 가능.
alter table public.answers drop constraint if exists answers_parent_question_day_key;
alter table public.answers drop column if exists session_date;
-- alter table public.answers add constraint answers_parent_id_question_id_key unique (parent_id, question_id);
