-- 0005 RPC: 하루 코스 기록, 연속일 계산, 오늘의 콘텐츠 번호. 설계 근거 docs/team/dev.md §5
-- 연속일은 저장하지 않고 계산한다. 같은 날 행은 unique(parent_id, session_date)로 1개라 두 번 완료해도 늘어나지 않는다.

-- 날짜는 항상 서버에서 Asia/Seoul 기준으로 계산한다(기기 시계·시간대 조작 방지).
create function public.kst_today() returns date language sql stable
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- 완료한 날(completed_at 있음)이 이어진 길이. 오늘 안 했어도 어제까지 이어졌으면 유지(하루 유예). security invoker라 RLS가 적용된다.
create function public.parent_streak(p_parent uuid, p_today date default public.kst_today()) returns int
language sql stable security invoker set search_path = ''
as $$
  with d as (
    select session_date from public.daily_sessions where parent_id = p_parent and completed_at is not null
  ), g as (
    select session_date, session_date - (row_number() over (order by session_date))::int as k from d
  )
  select case
    when (select max(session_date) from d) >= p_today - 1
      then (select count(*)::int from g where k = (select k from g order by session_date desc limit 1))
    else 0
  end
$$;

-- 어르신만 호출. 단계('photo','question','hangul')를 하루 행에 합쳐 넣는다.
create function public.record_session_step(p_step text, p_duration int default 0) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.kst_today();
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_steps text[];
  v_completed timestamptz;
  v_dur int := least(7200, greatest(0, coalesce(p_duration, 0)));
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  if p_step is null or p_step not in ('photo', 'question', 'hangul') then
    raise exception 'invalid_step';
  end if;

  insert into public.daily_sessions as ds (family_id, parent_id, session_date, completed_steps, duration_sec)
  values (v_family, v_me, v_today, array[p_step], v_dur)
  on conflict (parent_id, session_date) do update set
    completed_steps = (select array_agg(distinct s order by s) from unnest(ds.completed_steps || excluded.completed_steps) s),
    duration_sec = least(7200, greatest(ds.duration_sec, excluded.duration_sec))
  returning ds.completed_steps, ds.completed_at into v_steps, v_completed;

  -- 3단계가 모두 모인 첫 시각만 기록한다(이후 호출로 바뀌지 않음).
  if v_completed is null and cardinality(v_steps) = 3 then
    update public.daily_sessions set completed_at = now()
     where parent_id = v_me and session_date = v_today and completed_at is null
    returning completed_at into v_completed;
  end if;

  return jsonb_build_object('completed', v_completed is not null, 'steps', to_jsonb(v_steps), 'streak', public.parent_streak(v_me, v_today));
end $$;

-- 오늘의 콘텐츠 번호(1..N). N은 콘텐츠 행 수(사진·질문 중 적은 쪽)이며 day_index가 1..N으로 이어져 있다고 가정한다.
-- 첫 빌드는 14일분, 공개 전 30일분으로 늘려도 앱 수정이 필요 없다.
create function public.my_day_index() returns int
language sql stable security definer set search_path = ''
as $$
  select case when c.n = 0 then null
              else (mod(greatest(0, public.kst_today() - p.course_start_date), c.n) + 1)::int end
    from public.profiles p
   cross join lateral (
     select least((select count(*) from public.content_questions), (select count(*) from public.content_photos))::int as n
   ) c
   where p.user_id = auth.uid()
$$;

revoke execute on function public.record_session_step(text, int) from public, anon;
revoke execute on function public.my_day_index() from public, anon;
grant execute on function public.record_session_step(text, int) to authenticated;
grant execute on function public.my_day_index() to authenticated;
grant execute on function public.parent_streak(uuid, date) to authenticated;
grant execute on function public.kst_today() to authenticated;
