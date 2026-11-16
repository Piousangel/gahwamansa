-- 0006 RPC: 오늘의 콘텐츠 한 번에 가져오기, 답변 저장(갱신 가능)
-- 이유: answers는 unique(parent_id, question_id)인데 콘텐츠가 N일분이라 N+1일째에 같은 질문으로 순환한다.
--       직접 insert는 그때 중복 오류가 나므로, 같은 질문에 다시 답하면 갱신하는 RPC로 저장한다.

-- 어르신만. 오늘 콘텐츠(사진·질문·내가 이미 고른 답)를 서버가 번호 계산까지 해서 돌려준다. 콘텐츠가 없으면 null.
create function public.get_today_content() returns jsonb
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

-- 어르신만. 동의한 경우에만 저장하고, 같은 질문에 다시 답하면 갱신한다.
create function public.save_answer(p_question uuid, p_choice text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  if not public.my_consented() then
    raise exception 'consent_required';
  end if;
  if p_choice is null or p_choice not in ('A', 'B') then
    raise exception 'invalid_choice';
  end if;
  insert into public.answers (family_id, parent_id, question_id, choice)
  values (public.my_family_id(), public.my_profile_id(), p_question, p_choice)
  on conflict (parent_id, question_id) do update set choice = excluded.choice, answered_at = now();
end $$;

revoke execute on function public.get_today_content() from public, anon;
revoke execute on function public.save_answer(uuid, text) from public, anon;
grant execute on function public.get_today_content() to authenticated;
grant execute on function public.save_answer(uuid, text) to authenticated;
