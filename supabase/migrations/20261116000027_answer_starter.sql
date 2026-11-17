-- 0027 첫마디 한 줄(기능 회의 B3): 질문마다 선택지별 대화 시작 문장
-- content_questions.starter_a/b(null 허용). 문장(14일분 28개)은 라이터 몫이라 시드는 비워 둔다.
-- child_summary.latest.starter = 어르신이 고른 쪽 문장만(없으면 null). 고르지 않은 쪽은 주지 않는다. 키 추가만이라 하위 호환.
-- starter는 답의 뜻을 바꾸지 않아 0024 수정 금지 트리거 대상이 아니다(라이터가 나중에 채울 수 있음).

-- 길이 60자 이하(한 줄, 리뷰 L6). 빈 문자열은 금지(없으면 null).
alter table public.content_questions
  add column starter_a text check (char_length(starter_a) between 1 and 60),
  add column starter_b text check (char_length(starter_b) between 1 and 60);

-- 0021 정의 + latest.starter
create or replace function public.child_summary() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
  v_title text;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  select f.parent_title into v_title from public.families f where f.id = v_family;
  return jsonb_build_object(
    'parent_title', v_title,
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, v_title),
        'connected', p.user_id is not null,
        'shared', p.consented_at is not null,
        'latest', case when p.consented_at is null then null else (
          select jsonb_build_object(
            'prompt', q.prompt,
            'choice_label', case a.choice when 'A' then q.option_a else q.option_b end,
            'starter', case a.choice when 'A' then q.starter_a else q.starter_b end,
            'answered_date', a.session_date)
          from public.answers a join public.content_questions q on q.id = a.question_id
          where a.parent_id = p.id
          order by a.session_date desc, a.answered_at desc limit 1) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = v_family and p.role = 'parent'), '[]'::jsonb));
end $$;
