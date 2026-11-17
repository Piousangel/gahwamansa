-- 0021 자녀 "지난 답"(C5)과 연결 끊김 상태(C4)
-- 근거: docs/team/board/2026-11-17-design-session/C.md §3(최근 30일, 최신순, 날짜·질문·고른 답, 집계 없음, 동의한 어르신만),
--       docs/team/reviews/2026-11-17-design-session-review.md C항(어르신별 30개, session_date 기준, "A와 B 중" 와/과 처리),
--       DECISIONS "자녀 홈에 연결 끊김 상태".
-- 연결 끊김 = 어르신 프로필은 있으나 user_id가 비어 있음(기기 삭제·재설치 뒤 재연결 전). 카드는 유지하고 앱이 응원 버튼을 감춘다.
-- 30일 창: session_date >= kst_today() - 29 (오늘 포함 30일). 저장된 답 자체는 0023 파기 배치가 지운다.

-- "A와 B 중": 앞 낱말 끝 글자에 받침이 있으면 '과', 없으면 '와'.
-- 한글 음절은 코드값(44032~55203)으로 판정(정렬 규칙 비의존). 숫자는 읽는 소리로: 0영·1일·3삼·6육·7칠·8팔은 받침 있음
-- (10·20처럼 0으로 끝나면 십·백으로 읽혀도 받침 있음). 영문 등 그 밖은 '와'(콘텐츠 선택지는 한글이 원칙).
create function public.choice_pair_prompt(p_a text, p_b text) returns text
language sql immutable set search_path = ''
as $$
  select p_a || case
    when ascii(right(p_a, 1)) between 44032 and 55203 and (ascii(right(p_a, 1)) - 44032) % 28 <> 0 then '과 '
    when right(p_a, 1) in ('0', '1', '3', '6', '7', '8') then '과 '
    else '와 ' end || p_b || ' 중'
$$;
revoke execute on function public.choice_pair_prompt(text, text) from public, anon;

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
            'answered_date', a.session_date)
          from public.answers a join public.content_questions q on q.id = a.question_id
          where a.parent_id = p.id
          order by a.session_date desc, a.answered_at desc limit 1) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = v_family and p.role = 'parent'), '[]'::jsonb));
end $$;

-- 자녀만. 어르신마다 {parent_id, title, connected, shared, answers[]}. answers는 동의한 어르신의 최근 30일, 최신순, 최대 30개.
create function public.child_answer_history() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
  v_title text;
  v_from date := public.kst_today() - 29;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  select f.parent_title into v_title from public.families f where f.id = v_family;
  return jsonb_build_object(
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, v_title),
        'connected', p.user_id is not null,
        'shared', p.consented_at is not null,
        'answers', case when p.consented_at is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
                   'session_date', h.session_date,
                   'prompt', h.prompt,
                   'prompt_short', public.choice_pair_prompt(h.option_a, h.option_b),
                   'option_a', h.option_a,
                   'option_b', h.option_b,
                   'choice_label', case h.choice when 'A' then h.option_a else h.option_b end)
                 order by h.session_date desc, h.answered_at desc)
            from (select a.session_date, a.answered_at, a.choice, q.prompt, q.option_a, q.option_b
                    from public.answers a join public.content_questions q on q.id = a.question_id
                   where a.parent_id = p.id and a.session_date >= v_from
                   order by a.session_date desc, a.answered_at desc
                   limit 30) h), '[]'::jsonb) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = v_family and p.role = 'parent'), '[]'::jsonb));
end $$;

revoke execute on function public.child_answer_history() from public, anon;
grant execute on function public.child_answer_history() to authenticated;
grant execute on function public.choice_pair_prompt(text, text) to authenticated;
