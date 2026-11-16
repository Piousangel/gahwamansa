-- 0010 get_today_content에 앱 복원용 값 추가(코드 리뷰 6·11번): 동의 여부, 오늘 끝낸 단계, 연속일
create or replace function public.get_today_content() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_idx int;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  v_idx := public.my_day_index();
  if v_idx is null then return null; end if;
  return jsonb_build_object(
    'day_index', v_idx,
    'photo', (select jsonb_build_object('caption', p.caption, 'image_url', p.image_url, 'keyword', p.keyword,
                                         'recall_questions', to_jsonb(p.recall_questions))
                from public.content_photos p where p.day_index = v_idx),
    'question', (select jsonb_build_object('id', q.id, 'option_a', q.option_a, 'option_b', q.option_b, 'prompt', q.prompt)
                   from public.content_questions q where q.day_index = v_idx),
    'answered_choice', (select a.choice from public.answers a
                          join public.content_questions q on q.id = a.question_id
                         where a.parent_id = public.my_profile_id() and q.day_index = v_idx
                           and a.session_date = public.kst_today()),
    'consented', public.my_consented(),
    'completed_steps', to_jsonb(coalesce((select ds.completed_steps from public.daily_sessions ds
                         where ds.parent_id = public.my_profile_id() and ds.session_date = public.kst_today()), '{}')),
    'streak', public.parent_streak(public.my_profile_id(), public.kst_today())
  );
end $$;
