-- 0007 콘텐츠: 질문 문장(prompt)과 사진 회상 질문(recall_questions) 추가
-- 이유: 화면에서 어르신이 읽는 질문 문장과 "사진으로 추억 떠올리기"의 회상 질문이 서버 콘텐츠에 없었다.
-- 기존 행에는 영향이 없도록 prompt는 nullable, recall_questions는 빈 배열이 기본값이다.

alter table public.content_questions add column prompt text;
alter table public.content_photos add column recall_questions text[] not null default '{}';

-- get_today_content에 새 필드를 포함한다(시그니처 동일, create or replace).
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
    'photo', (select jsonb_build_object('caption', p.caption, 'image_url', p.image_url, 'keyword', p.keyword,
                                         'recall_questions', to_jsonb(p.recall_questions))
                from public.content_photos p where p.day_index = v_idx),
    'question', (select jsonb_build_object('id', q.id, 'option_a', q.option_a, 'option_b', q.option_b, 'prompt', q.prompt)
                   from public.content_questions q where q.day_index = v_idx),
    'answered_choice', (select a.choice from public.answers a
                          join public.content_questions q on q.id = a.question_id
                         where a.parent_id = public.my_profile_id() and q.day_index = v_idx)
  );
end $$;
