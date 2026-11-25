-- 0067 오늘 코스 4단계 완료 판정(기획 v2.1 docs/team/2026-11-26-plan-v2.md 0절 Q7 — ⑤ pass_on '가족에게 건넬 한마디'는 비운다).
-- 0061은 course_len 3|5만 받아, 4단계 앱(#287)이 ④ 뒤 pass_on을 '넘어감'으로 대신 기록해야 도장이 찍혔다(임시 A).
-- 이번(B): 서버가 4단계 코스(① photo ② recall ③ question ④ hangul)를 직접 완료로 인정한다. 앱은 대신 기록을 지운다.
--
-- (1) record_session_step — 시그니처·반환 모양·권한 그대로(create or replace). p_course_len에 4를 더한다(3|4|5).
--     완료 조건(그대로 '했어요 또는 넘어감'):
--       3 = photo·question·hangul (옛 앱 2인자 호출, 그대로)
--       4 = 3 + recall                (새 앱, 이번)
--       5 = 4 + pass_on              (0061 5단계 빌드, #287 대신 기록 빌드 — 그대로)
--     저장 열 course_len은 지금처럼 줄지 않는다(greatest — 3 < 4 < 5). 판정 길이는 저장 값이되, **이번 호출이 4를 보내면 4로 판정**한다:
--       같은 날 대신 기록 빌드(5)로 시작해 4단계 빌드로 마치는 경우(staging 테스터 폰 업데이트)에도 화면에 없는 ⑤ 때문에 도장이 막히지 않게.
--       옛 3단계 호출(기본값 3)은 지금처럼 저장 길이로 판정한다(5·4 세션을 옛 3단계로 일찍 찍지 않는다, 0061 원칙).
--     옛 대신 기록 빌드가 계속 pass_on 넘어감(p_course_len 5)을 보내도 안전: 이미 완료면 completed_at은 처음 값 그대로(completed=true 반환,
--       오류 아님), 아직이면 지금처럼 ⑤까지 차서 완료 — 0061과 같은 결과. 그 빌드는 completed=true를 받으면 대신 기록을 보내지 않는다(`!r.completed`).
--     '오늘은 여기까지'(stop_here, ③ 뒤): 4로 부르면 남은 ②·④만 넘어감으로 채운다(화면에 없는 ⑤는 기록하지 않음). 5·기본값이면 0061 그대로(②·④·⑤).
--     새 단계(recall·pass_on·stop_here)를 기본값 3으로 부르면 5로 보는 0061 규칙은 그대로(4는 앱이 명시할 때만).
--     잠금: 0061과 같다 — advance_content_cursor가 어르신 profiles 행 → daily_sessions upsert(families는 건드리지 않음, 잠금 순서 규칙 그대로).
-- (2) get_today_content(start_today가 감쌈)·preview_content에 계약 표지 four_steps_supported = true(0061 five_steps_supported와 같은 방식).
--     새 앱은 이 키가 있는 서버에서만 4단계로 돌고 p_course_len 4를 보낸다. 키가 없는 서버(0067 전)면 옛 3단계로 돈다
--     — 0067 전 서버에 4를 보내 invalid_course_len으로 막히는 일을 없앤다. 나머지 키·값은 0061 그대로.
-- 도장·완료 시각·통계: completed_at은 'completed_at is null'일 때 한 번만 찍는다(0061 그대로). course_completed 이벤트는 앱이
--   completed=true를 처음 받을 때만 보낸다(useFinishStep) — 서버는 완료 판정만 바꾸고 이벤트를 만들지 않는다.

alter table public.daily_sessions drop constraint daily_sessions_course_len_check,
  add constraint daily_sessions_course_len_check check (course_len in (3, 4, 5));
comment on column public.daily_sessions.course_len is
  '0061·0067: 3 = 옛 앱 코스(photo·question·hangul), 4 = 4단계(+ recall, 기획 v2.1 Q7), 5 = 5단계(+ pass_on). 줄지 않는다(가장 긴 값). 4로 부른 호출은 4로 판정';

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
  v_judge smallint;
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
  if p_course_len is null or p_course_len not in (3, 4, 5) then
    raise exception 'invalid_course_len';
  end if;
  -- 4·5는 앱이 명시한 값. 기본값 3인데 새 단계를 기록하면 5(0061 규칙 그대로)
  v_len := case when p_course_len in (4, 5) then p_course_len
                when p_step in ('recall', 'pass_on', 'stop_here') then 5
                else 3 end;

  perform public.advance_content_cursor(v_me); -- 하루 1회(같은 날이면 아무것도 안 함). 어르신 프로필 행을 잠근다(save_recall·철회와 줄 세움)

  if p_step = 'stop_here' then
    select ds.completed_steps into v_prev from public.daily_sessions ds where ds.parent_id = v_me and ds.session_date = v_today;
    if v_prev is null or not ('question' = any(v_prev)) then
      raise exception 'stop_before_question'; -- '오늘은 여기까지'는 ③을 마친(또는 넘긴) 뒤에만(R-3)
    end if;
    -- 빠진 ②까지 채운다(리뷰 QA-1 M1). 4단계 호출이면 화면에 없는 ⑤는 기록하지 않는다(0067)
    v_add := array(select s from unnest(case when p_course_len = 4 then array['recall', 'hangul']
                                             else array['recall', 'hangul', 'pass_on'] end) s
                    where not (s = any(v_prev)));
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

  -- 판정 길이: 저장 값(줄지 않음). 단 4로 부른 호출은 4(0067 머리말 (1))
  v_judge := case when p_course_len = 4 then 4 else v_len end;
  if v_completed is null
     and v_steps @> array['photo', 'question', 'hangul']
     and (v_judge = 3 or 'recall' = any(v_steps))
     and (v_judge <> 5 or 'pass_on' = any(v_steps)) then
    update public.daily_sessions set completed_at = now()
     where parent_id = v_me and session_date = v_today and completed_at is null
    returning completed_at into v_completed;
  end if;

  return jsonb_build_object('completed', v_completed is not null, 'steps', to_jsonb(v_steps), 'streak', public.parent_streak(v_me, v_today));
end $$;
-- create or replace라 0061의 권한(authenticated만 실행)이 그대로다. 관례대로 다시 적어 둔다.
revoke execute on function public.record_session_step(text, int, boolean, int) from public, anon;
grant execute on function public.record_session_step(text, int, boolean, int) to authenticated;

-- ---- (2) 계약 표지: 0061 정의 + four_steps_supported ----
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
    'four_steps_supported', true, -- 0067 계약 표지: p_course_len 4를 받는 서버. 키가 없으면 새 앱은 3단계로 돈다
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
    'four_steps_supported', true, -- 0067
    'linked', false);
end $$;
