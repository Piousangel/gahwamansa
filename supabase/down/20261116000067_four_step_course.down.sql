-- 0067 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: ① 4단계 앱(p_course_len 4)을 쓰는 기기가 없는지 확인 — 되돌린 뒤 그 앱은 표지(four_steps_supported)가 없어 3단계로 돈다(막히지 않음).
--       ② 아래를 위에서부터 실행: 쓰는 쪽(함수 3개)을 0061 정의로 → 데이터(course_len 4 → 5) → check.
-- 함수는 0061 정의 그대로 붙여 넣었다(create or replace라 권한은 그대로).
-- 주의: course_len 4로 남은 세션은 5로 바꾼다. 이미 찍힌 도장(completed_at)은 그대로 둔다. 오늘 아직 안 끝난 4단계 세션은 ⑤(넘어감)까지 있어야
--       완료되므로, 되돌린 뒤 그날 도장은 #287 대신 기록 빌드 또는 3단계로 다시 연 앱에서만 찍힌다(오늘 하루치만 영향).

create or replace function public.record_session_step(p_step text, p_duration int default 0, p_skipped boolean default false,
                                                      p_course_len int default 3) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.kst_today();
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_dur int := least(7200, greatest(0, coalesce(p_duration, 0)));
  v_skip boolean := coalesce(p_skipped, false);
  v_len smallint;
  v_add text[];
  v_addskip text[];
  v_unskip text[];
  v_prev text[];
  v_steps text[];
  v_completed timestamptz;
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  if p_step is null or p_step not in ('photo', 'recall', 'question', 'hangul', 'pass_on', 'stop_here') then
    raise exception 'invalid_step';
  end if;
  if v_skip and p_step in ('photo', 'stop_here') then
    raise exception 'invalid_step'; -- ① 사진 보기는 넘어가기 없음(기획 3.1), 여기까지는 넘어감이 아님
  end if;
  if p_course_len is null or p_course_len not in (3, 5) then
    raise exception 'invalid_course_len';
  end if;
  v_len := case when p_course_len = 5 or p_step in ('recall', 'pass_on', 'stop_here') then 5 else 3 end;

  perform public.advance_content_cursor(v_me); -- 하루 1회(같은 날이면 아무것도 안 함). 어르신 프로필 행을 잠근다(save_recall·철회와 줄 세움)

  if p_step = 'stop_here' then
    select ds.completed_steps into v_prev from public.daily_sessions ds where ds.parent_id = v_me and ds.session_date = v_today;
    if v_prev is null or not ('question' = any(v_prev)) then
      raise exception 'stop_before_question'; -- '오늘은 여기까지'는 ③을 마친(또는 넘긴) 뒤에만(R-3)
    end if;
    -- 빠진 ②까지 채운다(리뷰 QA-1 M1: ② 기록이 빠진 날도 여기까지로 도장이 찍히게 — 서버 방어)
    v_add := array(select s from unnest(array['recall', 'hangul', 'pass_on']) s where not (s = any(v_prev)));
    v_addskip := v_add;
    v_unskip := '{}';
  else
    v_add := array[p_step];
    v_addskip := case when v_skip then array[p_step] else '{}'::text[] end;
    v_unskip := case when v_skip then '{}'::text[] else array[p_step] end;
  end if;

  insert into public.daily_sessions as ds (family_id, parent_id, session_date, completed_steps, skipped_steps, duration_sec, course_len, stopped_here)
  values (v_family, v_me, v_today, v_add, v_addskip, v_dur, v_len, p_step = 'stop_here')
  on conflict (parent_id, session_date) do update set
    completed_steps = (select array_agg(distinct s order by s) from unnest(ds.completed_steps || excluded.completed_steps) s),
    skipped_steps = coalesce((select array_agg(distinct s order by s) from unnest(ds.skipped_steps || excluded.skipped_steps) s
                               where not (s = any(v_unskip))), '{}'),
    duration_sec = least(7200, greatest(ds.duration_sec, excluded.duration_sec)),
    course_len = greatest(ds.course_len, excluded.course_len),
    stopped_here = ds.stopped_here or excluded.stopped_here
  returning ds.completed_steps, ds.completed_at, ds.course_len into v_steps, v_completed, v_len;

  -- 넘긴 단계의 값은 남기지 않는다(넘긴 날 자녀에게 무표시, 법률 조건 4)
  if 'recall' = any(v_addskip) then
    delete from public.recall_picks where parent_id = v_me and session_date = v_today;
  end if;
  if 'pass_on' = any(v_addskip) then
    delete from public.pass_on_picks where parent_id = v_me and session_date = v_today;
  end if;
  if 'question' = any(v_addskip) then
    delete from public.answers where parent_id = v_me and session_date = v_today;
    -- 그 답을 끼운 ⑤ choice_like도 지운다(리뷰 QA-3 L1·QA-1 L2, ②의 recall_pick_deleted 트리거와 같은 뜻)
    delete from public.pass_on_picks where parent_id = v_me and session_date = v_today and line_key = 'choice_like';
  end if;

  if v_completed is null
     and v_steps @> array['photo', 'question', 'hangul']
     and (v_len = 3 or v_steps @> array['recall', 'pass_on']) then
    update public.daily_sessions set completed_at = now()
     where parent_id = v_me and session_date = v_today and completed_at is null
    returning completed_at into v_completed;
  end if;

  return jsonb_build_object('completed', v_completed is not null, 'steps', to_jsonb(v_steps), 'streak', public.parent_streak(v_me, v_today));
end $$;

create or replace function public.get_today_content() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_idx int;
  v_me uuid := public.my_profile_id();
  v_today date := public.kst_today();
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  v_idx := public.my_day_index();
  if v_idx is null then return null; end if;
  return jsonb_build_object(
    'day_index', v_idx,
    'five_steps_supported', true, -- 0061 계약 표지(리뷰 QA-1 L5): 키가 없는 서버면 앱은 3단계로 돈다
    'photo', (select jsonb_build_object('caption', p.caption, 'image_url', p.image_url, 'keyword', p.keyword,
                                         'recall_questions', to_jsonb(p.recall_questions))
                from public.content_photos p where p.day_index = v_idx),
    'question', (select jsonb_build_object('id', q.id, 'option_a', q.option_a, 'option_b', q.option_b, 'prompt', q.prompt)
                   from public.content_questions q where q.day_index = v_idx),
    'answered_choice', (select a.choice from public.answers a
                          join public.content_questions q on q.id = a.question_id
                         where a.parent_id = v_me and q.day_index = v_idx
                           and a.session_date = v_today),
    'answered_label', (select case a.choice when 'A' then q.option_a else q.option_b end from public.answers a
                          join public.content_questions q on q.id = a.question_id
                         where a.parent_id = v_me and q.day_index = v_idx
                           and a.session_date = v_today),
    'consented', public.my_consented(),
    'completed_steps', to_jsonb(coalesce((select ds.completed_steps from public.daily_sessions ds
                         where ds.parent_id = v_me and ds.session_date = v_today), '{}')),
    'skipped_steps', to_jsonb(coalesce((select ds.skipped_steps from public.daily_sessions ds
                         where ds.parent_id = v_me and ds.session_date = v_today), '{}')),
    'streak', public.parent_streak(v_me, v_today),
    'recall', jsonb_build_object(
      'options', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'label', o.label) order by o.slot)
                             from public.content_recall_options o where o.day_index = v_idx), '[]'::jsonb),
      'picked_slot', (select rp.slot from public.recall_picks rp
                       where rp.parent_id = v_me and rp.session_date = v_today and rp.day_index = v_idx)),
    'pass_on', jsonb_build_object(
      'enabled', public.server_flag('pass_on_store_enabled'),
      'picked_key', (select po.line_key from public.pass_on_picks po
                      where po.parent_id = v_me and po.session_date = v_today and po.day_index = v_idx))
  );
end $$;

create or replace function public.preview_content() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_idx int;
begin
  if public.my_profile_id() is not null then raise exception 'linked_use_get_today_content'; end if;
  with d as (
    select x.day_index, row_number() over (order by x.day_index) rn
      from (select p.day_index from public.content_photos p join public.content_questions q using (day_index)
             where p.retired_at is null and q.retired_at is null) x
  ), c as (select count(*) n from d)
  select d.day_index into v_idx from d, c
   where c.n > 0 and d.rn = mod(greatest(0, public.kst_today() - date '2026-01-01'), c.n) + 1;
  if v_idx is null then return null; end if;
  return jsonb_build_object(
    'day_index', v_idx,
    'photo', (select jsonb_build_object('caption', p.caption, 'image_url', p.image_url, 'keyword', p.keyword,
                                         'recall_questions', to_jsonb(p.recall_questions))
                from public.content_photos p where p.day_index = v_idx),
    'question', (select jsonb_build_object('id', q.id, 'option_a', q.option_a, 'option_b', q.option_b, 'prompt', q.prompt)
                   from public.content_questions q where q.day_index = v_idx),
    'recall', jsonb_build_object(
      'options', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'label', o.label) order by o.slot)
                             from public.content_recall_options o where o.day_index = v_idx), '[]'::jsonb),
      'picked_slot', null),
    'five_steps_supported', true,
    'linked', false);
end $$;

update public.daily_sessions set course_len = 5 where course_len = 4;
alter table public.daily_sessions drop constraint daily_sessions_course_len_check,
  add constraint daily_sessions_course_len_check check (course_len in (3, 5));
comment on column public.daily_sessions.course_len is '0061: 3 = 옛 앱 코스(photo·question·hangul로 완료), 5 = 5단계 코스(다섯 단계 모두로 완료). 줄지 않는다';
