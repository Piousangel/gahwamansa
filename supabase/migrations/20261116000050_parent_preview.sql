-- 0050 어르신 P13 '가족에게 이렇게 보여요' 미리보기 RPC (PR #11 리뷰 M1: 앱이 parent_history(30)를 걸러 자녀 화면을 흉내 내 어긋남)
-- 자녀 화면 계산을 내부 함수 두 개로 뺀다. child_summary·child_answer_history와 parent_preview_child_view가 같은 함수를 쓴다(복제 없음).
--   family_child_summary(가족, 어르신|null)  = child_summary 본문(0041): {parent_title, parents[{parent_id,title,connected,connected_date,shared,latest}]}
--   family_child_history(가족, 어르신|null)  = child_answer_history 본문(0021): {parents[{parent_id,title,connected,shared,answers[]}]}
--   어르신 인자가 null이면 가족의 어르신 전부(자녀), 값이 있으면 그 어르신 항목만(어르신 미리보기).
--   가족 id를 받으므로 앱·anon·서비스 역할 모두 직접 못 부른다(남의 가족 읽기 차단). 공개 RPC가 my_family_id()·my_profile_id()로만 넘긴다.
-- parent_preview_child_view(): 어르신 본인만(parent_required). {summary: child_summary와 같은 모양(본인 항목만), history: child_answer_history와 같은 모양(본인 항목만)}.
--   같은 가족의 다른 어르신 항목은 주지 않는다(그분은 자녀에게 공개를 동의한 것이지 다른 어르신에게가 아님). 자녀 정보는 원래 두 함수에 없다.
--   동의 안 함·철회면 자녀와 똑같이 shared=false, latest=null, answers=[].

create function public.family_child_summary(p_family uuid, p_parent uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'parent_title', (select f.parent_title from public.families f where f.id = p_family),
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, (select f.parent_title from public.families f where f.id = p_family)),
        'connected', p.user_id is not null,
        'connected_date', (p.created_at at time zone 'Asia/Seoul')::date, -- 0041: 처음 연결된 날(KST)
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
      where p.family_id = p_family and p.role = 'parent' and (p_parent is null or p.id = p_parent)), '[]'::jsonb))
$$;

create function public.family_child_history(p_family uuid, p_parent uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, (select f.parent_title from public.families f where f.id = p_family)),
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
                   where a.parent_id = p.id and a.session_date >= public.kst_today() - 29
                   order by a.session_date desc, a.answered_at desc
                   limit 30) h), '[]'::jsonb) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = p_family and p.role = 'parent' and (p_parent is null or p.id = p_parent)), '[]'::jsonb))
$$;

revoke execute on function public.family_child_summary(uuid, uuid), public.family_child_history(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.child_summary() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  return public.family_child_summary(public.my_family_id(), null);
end $$;

create or replace function public.child_answer_history() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  return public.family_child_history(public.my_family_id(), null);
end $$;

create function public.parent_preview_child_view() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
begin
  if v_me is null or public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  return jsonb_build_object(
    'summary', public.family_child_summary(public.my_family_id(), v_me),
    'history', public.family_child_history(public.my_family_id(), v_me));
end $$;
revoke execute on function public.parent_preview_child_view() from public, anon;
grant execute on function public.parent_preview_child_view() to authenticated;
