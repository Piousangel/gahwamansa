-- 되돌리기: 20261116000007_content_prompts.sql (수동 실행용). 0006의 함수 정의로 복원하고 컬럼을 지운다.
create or replace function public.get_today_content() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_idx int;
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  v_idx := public.my_day_index();
  if v_idx is null then
    return null;
  end if;
  return jsonb_build_object(
    'day_index', v_idx,
    'photo', (select jsonb_build_object('caption', p.caption, 'image_url', p.image_url, 'keyword', p.keyword)
                from public.content_photos p where p.day_index = v_idx),
    'question', (select jsonb_build_object('id', q.id, 'option_a', q.option_a, 'option_b', q.option_b)
                   from public.content_questions q where q.day_index = v_idx),
    'answered_choice', (select a.choice from public.answers a
                          join public.content_questions q on q.id = a.question_id
                         where a.parent_id = public.my_profile_id() and q.day_index = v_idx)
  );
end $$;
alter table public.content_photos drop column if exists recall_questions;
alter table public.content_questions drop column if exists prompt;
