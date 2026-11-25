-- 0065 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: 읽는 함수를 옛 정의로 → 스위치 이름 목록 → 열·검사 함수. 주의: care_a·care_b에 채운 문장(시드 60줄)이 함께 지워진다(시드 파일에 원본이 있다).
--   server_flags에 care_lines_enabled 행이 있으면 먼저 지운다(아래 delete).

create or replace function public.family_child_summary(p_family uuid, p_parent uuid) returns jsonb
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

create or replace function public.family_child_history(p_family uuid, p_parent uuid) returns jsonb
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
                   limit 30) h), '[]'::jsonb) end,
        'recalls', case when p.consented_at is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('session_date', r.session_date, 'label', r.label) order by r.session_date desc)
            from (select rp.session_date, o.label
                    from public.recall_picks rp
                    join public.content_recall_options o on o.day_index = rp.day_index and o.slot = rp.slot
                   where rp.parent_id = p.id and rp.session_date >= public.kst_today() - 29
                   order by rp.session_date desc
                   limit 30) r), '[]'::jsonb) end,
        'pass_ons', case when p.consented_at is null or not public.server_flag('pass_on_store_enabled') then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
                   'session_date', x.session_date, 'line_key', x.line_key, 'recall_label', x.recall_label,
                   'choice_label', x.choice_label, 'option_a', x.option_a, 'option_b', x.option_b)
                 order by x.session_date desc)
            from (select po.session_date, po.line_key,
                         (select o.label from public.recall_picks rp
                            join public.content_recall_options o on o.day_index = rp.day_index and o.slot = rp.slot
                           where rp.parent_id = po.parent_id and rp.session_date = po.session_date) recall_label,
                         (select case a.choice when 'A' then q.option_a else q.option_b end
                            from public.answers a join public.content_questions q on q.id = a.question_id
                           where a.parent_id = po.parent_id and a.session_date = po.session_date
                           order by a.answered_at desc limit 1) choice_label,
                         dq.option_a, dq.option_b
                    from public.pass_on_picks po
                    join public.daily_sessions ds on ds.parent_id = po.parent_id and ds.session_date = po.session_date
                    left join public.content_questions dq on dq.id = coalesce(ds.question_id,
                              (select q2.id from public.content_questions q2 where q2.day_index = po.day_index))
                   where po.parent_id = p.id and po.session_date >= public.kst_today() - 29
                   order by po.session_date desc
                   limit 30) x
           where (x.line_key <> 'recall_story' or x.recall_label is not null)
             and (x.line_key <> 'choice_like' or x.choice_label is not null)), '[]'::jsonb) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = p_family and p.role = 'parent' and (p_parent is null or p.id = p_parent)), '[]'::jsonb))
$$;

delete from public.server_flags where name = 'care_lines_enabled';
alter table public.server_flags drop constraint server_flags_name_check,
  add constraint server_flags_name_check check (name in ('dev_reset_enabled', 'pass_on_store_enabled'));
drop function if exists public.care_lines_visible(uuid);
alter table public.content_questions drop column if exists care_a, drop column if exists care_b;
drop function if exists public.care_line_ok(text);
