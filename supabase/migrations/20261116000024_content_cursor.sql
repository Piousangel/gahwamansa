-- 0024 콘텐츠 순번: 어르신별 커서 + 게시 콘텐츠 수정 금지 + day_index 상한 제거
-- 근거: docs/plans/11-backoffice.md, docs/team/reviews/2026-11-17-backoffice-plan-review.md 높음 1·3항, DECISIONS 2026-11-17 위임(0024, 어르신별 커서),
--       리드 결정(start_today 별도 RPC, get_today_content 읽기 전용, 빠진 날 건너뛰지 않음).
-- 문제: 기존 my_day_index = mod(오늘 - course_start_date, n) + 1. 콘텐츠가 1개만 늘어도 n이 바뀌어 한 바퀴 이상 돈 어르신의 '오늘'이 밀린다.
--       날짜 차이로 계산하는 어떤 공식도 n이 바뀌면 밀린다(리뷰 높음 1).
-- 설계:
--   profiles.content_seq(지금 보고 있는 day_index), content_seq_date(그 콘텐츠를 연 KST 날짜). 이력 없이 값 1개.
--   다음 콘텐츠 = 활성 콘텐츠(사진·질문 둘 다 있고 은퇴 안 함) 중 커서보다 큰 가장 작은 day_index, 없으면 처음으로(가장 작은 것).
--   전진은 advance_content_cursor(내부)가 KST 날짜가 바뀌었을 때만 1칸. start_today()(앱이 코스 홈 진입 시)와 record_session_step이 부른다
--   (앱이 start_today를 빠뜨려도 같은 콘텐츠가 반복되지 않게). 며칠 쉬어도 1칸 → "하루 한 장, 놓친 장 없이".
--   get_today_content(stable)는 쓰지 않고, 오늘 이미 열었으면 커서, 아니면 "열면 나올 다음 콘텐츠"를 보여 준다(start_today 결과와 같음).
--   처음 연결(커서 null)은 첫 콘텐츠부터. 재연결은 같은 프로필이라 커서가 이어진다. preview_content(미연결)는 날짜 기반 유지(은퇴만 제외).
--   답 존재로 "본 날"을 판정하지 않으므로 31일 파기(0023)와 충돌하지 않는다. streak·week_stamps는 daily_sessions만 봐서 무관.
-- 운영 규칙: 새 콘텐츠는 끝(가장 큰 day_index 뒤)에만 추가. 구멍 메우기·앞쪽 끼우기 금지(이미 지나간 어르신은 다음 바퀴에 본다).
--   게시된 문항(prompt·option_a/b)·사진(caption·keyword·recall_questions)·day_index는 수정 금지(트리거). 고칠 땐 새 행 + 옛 행 retired_at.
--   사진 image_url은 저장 위치라 변경 허용(scripts/photos/upload-photos.mjs). 행 삭제는 막지 않는다(답이 달린 문항은 FK가 막음).
-- 이행: 기존 어르신은 이전 공식의 오늘 값으로 커서를 채우고 날짜=오늘 → 반영 순간 '오늘'이 바뀌지 않는다.

alter table public.content_photos drop constraint content_photos_day_index_check,
  add constraint content_photos_day_index_check check (day_index >= 1);
alter table public.content_questions drop constraint content_questions_day_index_check,
  add constraint content_questions_day_index_check check (day_index >= 1);
alter table public.content_photos add column retired_at timestamptz;
alter table public.content_questions add column retired_at timestamptz;

alter table public.profiles add column content_seq int, add column content_seq_date date; -- authenticated에 select 미부여(참여 정보)
alter table public.daily_sessions add column day_index int; -- 그날 연 콘텐츠 번호(기록용)

-- 이행: 이전 공식(0009 my_day_index)의 오늘 값으로 고정
with d as (
  select x.day_index, row_number() over (order by x.day_index) rn
    from (select p.day_index from public.content_photos p join public.content_questions q using (day_index)) x
), c as (select count(*) n from d)
update public.profiles pr
   set content_seq = (select d.day_index from d where d.rn = mod(greatest(0, public.kst_today() - pr.course_start_date), c.n) + 1),
       content_seq_date = public.kst_today()
  from c
 where pr.role = 'parent' and c.n > 0;

-- ---- 게시 콘텐츠 수정 금지 ----
create function public.content_immutable_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.retired_at is not null and new.retired_at is distinct from old.retired_at then
    raise exception 'content_immutable: retired_at cannot change once set';
  end if;
  if tg_table_name = 'content_questions' then
    if (new.day_index, new.option_a, new.option_b, new.prompt) is distinct from (old.day_index, old.option_a, old.option_b, old.prompt) then
      raise exception 'content_immutable: add a new row and retire the old one';
    end if;
  else
    if (new.day_index, new.caption, new.keyword, new.recall_questions) is distinct from (old.day_index, old.caption, old.keyword, old.recall_questions) then
      raise exception 'content_immutable: add a new row and retire the old one';
    end if;
  end if;
  return new;
end $$;
create trigger content_questions_immutable before update on public.content_questions
  for each row execute function public.content_immutable_guard();
create trigger content_photos_immutable before update on public.content_photos
  for each row execute function public.content_immutable_guard();

-- ---- 커서 ----
-- p_after 다음 활성 콘텐츠(없으면 처음으로). 콘텐츠가 없으면 null.
create function public.content_next_day(p_after int) returns int
language sql stable security definer set search_path = ''
as $$
  with a as (
    select p.day_index from public.content_photos p join public.content_questions q using (day_index)
     where p.retired_at is null and q.retired_at is null
  )
  select coalesce((select min(day_index) from a where day_index > coalesce(p_after, 0)), (select min(day_index) from a))
$$;
revoke execute on function public.content_next_day(int) from public, anon, authenticated;

-- 오늘 볼 콘텐츠 번호(읽기 전용): 오늘 이미 열었으면 커서, 아니면 열면 나올 다음 번호
create or replace function public.my_day_index() returns int
language sql stable security definer set search_path = ''
as $$
  select case when pr.content_seq is not null and pr.content_seq_date = public.kst_today() then pr.content_seq
              else public.content_next_day(pr.content_seq) end
    from public.profiles pr
   where pr.user_id = auth.uid()
$$;

-- 내부: 날짜가 바뀌었을 때만 1칸 전진하고 오늘 세션 행에 번호를 남긴다. 전진했으면 true.
create function public.advance_content_cursor(p_profile uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.kst_today();
  v_pr public.profiles%rowtype;
  v_next int;
  v_adv boolean := false;
begin
  select * into v_pr from public.profiles where id = p_profile and role = 'parent' for update;
  if not found then return false; end if;
  if v_pr.content_seq is null or v_pr.content_seq_date is distinct from v_today then
    v_next := public.content_next_day(v_pr.content_seq);
    if v_next is null then return false; end if; -- 콘텐츠 없음
    update public.profiles set content_seq = v_next, content_seq_date = v_today where id = p_profile;
    v_pr.content_seq := v_next;
    v_adv := true;
  end if;
  insert into public.daily_sessions as ds (family_id, parent_id, session_date, day_index)
  values (v_pr.family_id, p_profile, v_today, v_pr.content_seq)
  on conflict (parent_id, session_date) do update set day_index = coalesce(ds.day_index, excluded.day_index);
  return v_adv;
end $$;
revoke execute on function public.advance_content_cursor(uuid) from public, anon, authenticated;

-- 어르신 본인만. 코스 홈 진입 시 호출. 반환 = get_today_content() + advanced(오늘 처음 열어 전진했는지). 콘텐츠가 없으면 null.
create function public.start_today() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_adv boolean;
  v_content jsonb;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  v_adv := public.advance_content_cursor(public.my_profile_id());
  v_content := public.get_today_content();
  if v_content is null then return null; end if;
  return v_content || jsonb_build_object('advanced', v_adv);
end $$;
revoke execute on function public.start_today() from public, anon;
grant execute on function public.start_today() to authenticated;

-- record_session_step(0005)에 전진 연동만 추가(나머지 동일)
create or replace function public.record_session_step(p_step text, p_duration int default 0) returns jsonb
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

  perform public.advance_content_cursor(v_me); -- 하루 1회(같은 날이면 아무것도 안 함)

  insert into public.daily_sessions as ds (family_id, parent_id, session_date, completed_steps, duration_sec)
  values (v_family, v_me, v_today, array[p_step], v_dur)
  on conflict (parent_id, session_date) do update set
    completed_steps = (select array_agg(distinct s order by s) from unnest(ds.completed_steps || excluded.completed_steps) s),
    duration_sec = least(7200, greatest(ds.duration_sec, excluded.duration_sec))
  returning ds.completed_steps, ds.completed_at into v_steps, v_completed;

  if v_completed is null and cardinality(v_steps) = 3 then
    update public.daily_sessions set completed_at = now()
     where parent_id = v_me and session_date = v_today and completed_at is null
    returning completed_at into v_completed;
  end if;

  return jsonb_build_object('completed', v_completed is not null, 'steps', to_jsonb(v_steps), 'streak', public.parent_streak(v_me, v_today));
end $$;

-- 미연결 열람(0015): 날짜 기반 유지, 은퇴한 콘텐츠만 제외
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
    'linked', false);
end $$;
