-- 0061 오늘 코스 3단계 → 5단계 서버 계약(DECISIONS 2026-11-25 R-1·R-3, 기획 docs/team/board/2026-11-25-course-five-steps.md,
--      법률 docs/team/legal/2026-11-24-free-cheer-and-d1-scope.md 4.3 조건 4개, 시안 docs/design/2026-11-25-five-steps/)
-- 단계: ① photo → ② recall(떠올려 보기, 새) → ③ question → ④ hangul → ⑤ pass_on(이야기 건네기, 새). ③ 뒤 '오늘은 여기까지'(stop_here).
--
-- (1) 완료(도장) 판정 — record_session_step(p_step, p_duration, p_skipped default false, p_course_len default 3)
--     옛 앱은 지금처럼 (p_step, p_duration)만 보낸다 → 기본값으로 풀려 3단계 코스로 판정(옛 3단계 photo·question·hangul 모두 있으면 완료).
--     새 앱은 모든 호출에 p_course_len = 5를 보낸다. 세션이 한 번이라도 5단계(p_course_len = 5 또는 recall·pass_on·stop_here 기록)이면
--     course_len = 5로 굳고(줄지 않음), 다섯 단계가 모두 '했어요 또는 넘어감'일 때 완료.
--       - stop_here('오늘은 여기까지', ③을 마친 뒤만): 아직 안 한 ④·⑤를 넘어감으로 기록 → 다섯 단계가 다 차서 완료. ③ 전이면 예외 stop_before_question.
--       - 넘어감: p_skipped = true. 완료 단계(completed_steps)에도 넣고 skipped_steps에도 넣는다(넘어감도 '했어요', 기획 3.3).
--         넘긴 단계의 저장 값은 지운다(② 고른 것·⑤ 건넨 말·③ 답) → 넘긴 날 자녀에게 아무것도 없다(법률 조건 4). ①은 넘어갈 수 없다(invalid_step).
--         넘긴 단계를 나중에 다시 하면(p_skipped = false) skipped_steps에서 빠진다('오늘은 여기까지' 뒤 ④·⑤ 다시 하기, 시안 4).
--     완료 시각(completed_at)은 처음 한 번만 찍고 되돌리지 않는다. 반환 모양은 그대로({completed, steps, streak}).
--     옛 앱·새 앱이 섞여도: 판정이 세션(어르신·날짜)마다 따로라 서로 영향 없음. 배포는 서버 먼저 무해(옛 앱은 3단계 판정 그대로).
-- (2) ② 떠올린 것 — content_recall_options(그날 보기 3개) + recall_picks(고른 보기 번호만, 자유 글 칸 없음) + save_recall(p_day_index, p_slot)
--     P2 동의(consented_at) 중에만 저장(아니면 consent_required, 저장 0). 31일 파기·admin_delete_answers·dev_reset_today는 daily_sessions
--     FK cascade로, '그만 보여 주기'(withdraw_consent)는 profiles 트리거로, 계정·가족 삭제는 profiles·families FK cascade로 함께 지워진다.
-- (3) ⑤ 건넨 말 — pass_on_picks(틀 문장 키만, pass_on_key_ok) + save_pass_on(p_day_index, p_key). 같은 조건 + **서버 스위치
--     server_flags.pass_on_store_enabled**(행 없음 = 꺼짐, 법률 L-11 회신 전 기본). 꺼져 있으면 저장 거부(disabled), 자녀·미리보기에도 안 나간다.
--     틀 문장의 글자는 서버에 없다(라이터 copy, 법률 승인 키만 앱에 표시). 끼워 넣는 값은 같은 날 ②·③ 값을 다시 읽는다(새 글자 저장 없음).
-- (4) 자녀 읽기 — family_child_history(child_answer_history·parent_preview_child_view 공통)의 어르신 항목에 recalls·pass_ons 두 배열을 더한다.
--     기존 answers 배열·키는 그대로(옛 자녀 앱 파서는 모르는 키를 무시). 최근 30일·최대 30개·동의 중만. 넘긴 날은 행이 없어 무표시.
--     '목록엔 ② 한 줄만, ⑤는 앨범·날짜 상세만'(시안 6)은 앱 표시 몫 — 서버는 두 값을 함께 준다.
-- (5) 어르신 읽기 — get_today_content(start_today)·preview_content에 recall{options, picked_slot}·pass_on{enabled, picked_key}·skipped_steps,
--     parent_history 날마다 recall_label·pass_on_key(키 추가만).
-- (6) 이벤트 step 값에 recall·pass_on·stop_here(event_prop_ok, 앱 계약 events.ts). 값은 단계 이름뿐 — 고른 낱말·문장은 싣지 않는다.
-- 앱 계약 규칙(리뷰 QA-1 M1·L6, 리드 결정): ② 보기가 없는 날(recall.options = [])·⑤ 스위치가 꺼진 날(pass_on.enabled = false)에도
--   앱은 그 단계를 p_skipped = true로 기록한다(안 하면 5단계 세션은 도장이 안 찍힌다). 서버 방어로 stop_here는 빠진 ②까지 채운다.
--   stop_before_question은 자정을 넘겨 새 날 세션이 된 경우에도 난다 → 앱은 오늘 콘텐츠를 다시 불러 홈에서 이어 하게 한다.
--   넘긴 단계는 저장 RPC가 skipped로 거부한다(save_answer는 예외 'skipped') — 저장 뒤 넘김이든 넘김 뒤 저장이든 넘긴 날 무표시.
-- 콘텐츠 값(② 보기 90개)은 넣지 않는다 — 라이터 PR 병합 뒤 별도 적재. 형식은 supabase/seed_recall_options.sql 머리말.

-- ---- (1) 단계·넘어감·코스 길이 ----
alter table public.daily_sessions drop constraint daily_sessions_completed_steps_check;
alter table public.daily_sessions
  add constraint daily_sessions_completed_steps_check
    check (completed_steps <@ array['photo', 'recall', 'question', 'hangul', 'pass_on']),
  add column skipped_steps text[] not null default '{}',
  add column course_len smallint not null default 3,
  add column stopped_here boolean not null default false,
  add constraint daily_sessions_skipped_steps_check
    check (skipped_steps <@ completed_steps and not ('photo' = any(skipped_steps))),
  add constraint daily_sessions_course_len_check check (course_len in (3, 5));
comment on column public.daily_sessions.skipped_steps is '0061: 넘어간 단계(completed_steps의 부분집합). 넘긴 단계의 값은 저장하지 않는다';
comment on column public.daily_sessions.course_len is '0061: 3 = 옛 앱 코스(photo·question·hangul로 완료), 5 = 5단계 코스(다섯 단계 모두로 완료). 줄지 않는다';
comment on column public.daily_sessions.stopped_here is '0061: ③ 뒤 ''오늘은 여기까지''로 마친 날(이용 기록, 자녀에게 안 보냄)';

-- ---- (2) ② 보기·고른 것, (3) ⑤ 틀 키·건넨 것 ----
create table public.content_recall_options (
  day_index int not null references public.content_photos(day_index) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  label text not null check (label ~ '^[가-힣]{2,4}$'), -- 기획 3.2·라이터 2절 제안: 한글 2~4자 한 낱말(④에서 그대로 쓰고 자녀 줄 조사 판정이 늘 됨)
  primary key (day_index, slot),
  unique (day_index, label)
);
comment on table public.content_recall_options is '0061: ② 떠올려 보기 그날 보기 3개(day_index = content_photos). 게시 뒤 수정·삭제 금지(콘텐츠 규칙 0024와 같음)';

create function public.content_recall_options_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'content_immutable: add a new day and retire the old one';
  end if;
  if coalesce(current_setting('bumo.allow_content_delete', true), '') <> 'on' then
    raise exception 'content_immutable: published content cannot be deleted, set retired_at instead';
  end if;
  return old;
end $$;
revoke execute on function public.content_recall_options_guard() from public, anon, authenticated, service_role;
create trigger content_recall_options_immutable before update or delete on public.content_recall_options
  for each row execute function public.content_recall_options_guard();

-- ⑤ 틀 문장 키(기획 3.2 초안 4개). 목록은 함수 본문(행 검사 아님, cheer_key_ok 0060과 같은 방식). 정본은 앱 계약 app/src/api/contract/fiveSteps.ts PASS_ON_KEYS.
--   라이터 확정 5키(docs/team/copy/2026-11-25-five-steps-copy.md 4.2, DECISIONS 11-25 #252). 카드는 늘 3장, 자리마다 둘 중 하나:
--   자리 1: recall_story 「{떠올린 것} 얘기할게요」(②를 고른 날) / photo_memory 「사진 보니 옛 생각 나요」(②를 넘긴 날)
--   자리 2: choice_like 「{고른 쪽}, 그게 좋아요」(③을 고른 날) / photo_like 「오늘 사진이 좋아요」(③을 넘긴 날)
--   자리 3: ask_which 「어느 쪽일지 궁금해요」 + 보조 줄 「{③ 보기 A} · {③ 보기 B}」(늘)
--   문장은 라이터가 확정하고 법률 승인 키만 앱에 보인다. 키를 빼지 않는다(빼려면 pass_on_picks 행을 먼저 지우고 check 재검사, 0060 머리말과 같음).
create function public.pass_on_key_ok(p_key text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_key in ('recall_story', 'photo_memory', 'choice_like', 'photo_like', 'ask_which'), false)
$$;
revoke execute on function public.pass_on_key_ok(text) from public, anon, authenticated;

create table public.recall_picks (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  session_date date not null,
  day_index int not null,
  slot smallint not null,
  picked_at timestamptz not null default now(),
  primary key (parent_id, session_date),
  foreign key (parent_id, session_date) references public.daily_sessions(parent_id, session_date) on delete cascade,
  foreign key (day_index, slot) references public.content_recall_options(day_index, slot) on delete cascade
);
create index on public.recall_picks (family_id, session_date desc);
comment on table public.recall_picks is '0061: ② 고른 보기 번호(정해진 보기만, 글자 칸 없음). P2 동의 중에만. 세션(31일 파기)·철회·계정 삭제와 함께 지워진다';

create table public.pass_on_picks (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  session_date date not null,
  day_index int not null,
  line_key text not null check (public.pass_on_key_ok(line_key)),
  picked_at timestamptz not null default now(),
  primary key (parent_id, session_date),
  foreign key (parent_id, session_date) references public.daily_sessions(parent_id, session_date) on delete cascade
);
create index on public.pass_on_picks (family_id, session_date desc);
comment on table public.pass_on_picks is '0061: ⑤ 건넨 말 틀 키만. 서버 스위치 pass_on_store_enabled(법률 L-11) + P2 동의 중에만. 지워지는 길은 recall_picks와 같다';

-- 앱·anon·서비스 역할 모두 직접 읽기·쓰기 불가(쓰기는 definer RPC, 읽기는 자녀·어르신 RPC만). 서비스 역할은 보기 표 읽기만(운영 확인).
alter table public.content_recall_options enable row level security;
alter table public.recall_picks enable row level security;
alter table public.pass_on_picks enable row level security;
revoke all on public.content_recall_options, public.recall_picks, public.pass_on_picks from public, anon, authenticated, service_role;
grant select on public.content_recall_options to service_role;

-- ⑤ 저장 스위치(법률 L-11). 마이그레이션은 행을 넣지 않는다 = 모든 환경 꺼짐. 켜기는 L-11 회신 뒤 운영자(postgres, dev-server-notes §15 방식).
alter table public.server_flags drop constraint server_flags_name_check,
  add constraint server_flags_name_check check (name in ('dev_reset_enabled', 'pass_on_store_enabled'));

-- '그만 보여 주기'(consented_at → null): 고른 것·건넨 것 즉시 삭제(answers는 withdraw_consent가 지운다). 어떤 경로로 철회돼도 같게 트리거로.
create function public.five_steps_consent_withdrawn() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.recall_picks where parent_id = new.id;
  delete from public.pass_on_picks where parent_id = new.id;
  return null;
end $$;
revoke execute on function public.five_steps_consent_withdrawn() from public, anon, authenticated, service_role;
create trigger profiles_consent_withdrawn_picks after update of consented_at on public.profiles
  for each row when (old.consented_at is not null and new.consented_at is null)
  execute function public.five_steps_consent_withdrawn();

-- ② 고른 것이 지워지면(넘어감·바꿈 아님) 그 값을 끼운 ⑤ recall_story도 지운다(빈 자리 문장 방지).
create function public.recall_pick_deleted() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.pass_on_picks where parent_id = old.parent_id and session_date = old.session_date and line_key = 'recall_story';
  return null;
end $$;
revoke execute on function public.recall_pick_deleted() from public, anon, authenticated, service_role;
create trigger recall_picks_deleted after delete on public.recall_picks
  for each row execute function public.recall_pick_deleted();

-- ---- (1) record_session_step: 옛 2인자 정의(0024)를 기본값 4인자 하나로(PostgREST 이름 인자 호출이 그대로 풀림, 0059 send_cheer와 같은 방식) ----
drop function public.record_session_step(text, int);
create function public.record_session_step(p_step text, p_duration int default 0, p_skipped boolean default false,
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
revoke execute on function public.record_session_step(text, int, boolean, int) from public, anon;
grant execute on function public.record_session_step(text, int, boolean, int) to authenticated;

-- 오늘(KST) 그 단계가 넘어감으로 기록돼 있는가(내부, 저장 RPC 공통)
create function public.five_steps_skipped(p_parent uuid, p_step text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.daily_sessions ds
                  where ds.parent_id = p_parent and ds.session_date = public.kst_today() and p_step = any(ds.skipped_steps))
$$;
revoke execute on function public.five_steps_skipped(uuid, text) from public, anon, authenticated, service_role;

-- save_answer(0052) + ③을 넘긴 날은 저장 거부(리뷰 QA-3 M1·QA-1 M2, 리드 결정). 반환형(void)·예외 계약을 그대로 두려고
-- 다른 거부(consent_required·invalid_choice)처럼 예외 'skipped'로 알린다. 옛 앱은 넘어감을 보내지 않으므로 만나지 않는다.
create or replace function public.save_answer(p_question uuid, p_choice text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_new boolean;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  perform 1 from public.profiles where id = v_me for update; -- 철회와 직렬화
  if not public.my_consented() then raise exception 'consent_required'; end if;
  if p_choice is null or p_choice not in ('A', 'B') then raise exception 'invalid_choice'; end if;
  if public.five_steps_skipped(v_me, 'question') then raise exception 'skipped'; end if; -- 0061
  insert into public.answers (family_id, parent_id, question_id, choice, session_date)
  values (v_family, v_me, p_question, p_choice, public.kst_today())
  on conflict (parent_id, question_id, session_date) do update set choice = excluded.choice, answered_at = now()
  returning (xmax = 0) into v_new; -- true = 새 답(고치기 아님)
  if v_new
     and not exists (select 1 from public.families f where f.id = v_family and f.is_review)
     and exists (select 1 from public.profiles c where c.family_id = v_family and c.role = 'child'
                  and not exists (select 1 from public.first_answer_notices n where n.child_id = c.id))
     and not exists (select 1 from public.notification_queue q where q.family_id = v_family and q.kind = 'parent_first_answer' and q.sent_at is null) then
    insert into public.notification_queue (family_id, kind, payload) values (v_family, 'parent_first_answer', jsonb_build_object('parent_id', v_me));
  end if;
end $$;

-- ---- (2) save_recall: ② 고른 보기 저장 ----
-- {ok:true} | {ok:false, reason:'consent_required'|'no_content'|'stale_day'|'skipped'|'invalid_option'}. 역할 오류는 예외 parent_required.
-- no_content: 오늘 콘텐츠가 없거나 그날 ② 보기가 없음(앱은 ②를 p_skipped로 기록 — 계약 규칙, 리뷰 QA-1 M1).
-- skipped: 오늘 ②가 넘어감으로 기록돼 있음(넘긴 날 무표시를 호출 순서에 기대지 않고 서버가 강제, 리뷰 QA-3 M1).
--   넘김 뒤 '다시 하기'로 실제로 하면 record_session_step(p_skipped=false)이 skipped에서 빼므로 그 뒤 저장은 정상.
-- p_day_index = 앱이 보여 준 콘텐츠 날(자정을 넘겨 어제 보기로 저장되는 것 방지). 같은 날 다시 고르면 바꾼다.
create function public.save_recall(p_day_index int, p_slot int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_today date := public.kst_today();
  v_day int;
begin
  if v_me is null or public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  perform 1 from public.profiles where id = v_me for update; -- 철회·단계 기록과 줄 세움
  if not public.my_consented() then return jsonb_build_object('ok', false, 'reason', 'consent_required'); end if;
  perform public.advance_content_cursor(v_me);
  select ds.day_index into v_day from public.daily_sessions ds where ds.parent_id = v_me and ds.session_date = v_today;
  if v_day is null then return jsonb_build_object('ok', false, 'reason', 'no_content'); end if;
  if p_day_index is distinct from v_day then return jsonb_build_object('ok', false, 'reason', 'stale_day'); end if;
  if not exists (select 1 from public.content_recall_options o where o.day_index = v_day) then
    return jsonb_build_object('ok', false, 'reason', 'no_content');
  end if;
  if public.five_steps_skipped(v_me, 'recall') then return jsonb_build_object('ok', false, 'reason', 'skipped'); end if;
  if not exists (select 1 from public.content_recall_options o where o.day_index = v_day and o.slot = p_slot) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_option');
  end if;
  insert into public.recall_picks (parent_id, family_id, session_date, day_index, slot)
  values (v_me, v_family, v_today, v_day, p_slot)
  on conflict (parent_id, session_date) do update set slot = excluded.slot, day_index = excluded.day_index, picked_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.save_recall(int, int) from public, anon;
grant execute on function public.save_recall(int, int) to authenticated;

-- ---- (3) save_pass_on: ⑤ 건넨 말 틀 키 저장(스위치 꺼짐 = 거부) ----
-- {ok:true} | {ok:false, reason:'disabled'|'consent_required'|'invalid_key'|'no_content'|'stale_day'|'skipped'|'missing_value'}.
-- skipped: 오늘 ⑤가 넘어감(여기까지 포함)으로 기록돼 있음(리뷰 QA-3 M1). 스위치가 꺼진 날 앱은 ⑤를 p_skipped로 기록한다(계약 규칙, QA-1 M1).
-- missing_value: recall_story인데 오늘 ② 고른 것이 없음, choice_like인데 오늘 ③ 답이 없음(끼울 값 없는 문장 방지).
create function public.save_pass_on(p_day_index int, p_key text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_today date := public.kst_today();
  v_day int;
begin
  if v_me is null or public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  perform 1 from public.profiles where id = v_me for update;
  if not public.server_flag('pass_on_store_enabled') then return jsonb_build_object('ok', false, 'reason', 'disabled'); end if;
  if not public.my_consented() then return jsonb_build_object('ok', false, 'reason', 'consent_required'); end if;
  if not public.pass_on_key_ok(p_key) then return jsonb_build_object('ok', false, 'reason', 'invalid_key'); end if;
  perform public.advance_content_cursor(v_me);
  select ds.day_index into v_day from public.daily_sessions ds where ds.parent_id = v_me and ds.session_date = v_today;
  if v_day is null then return jsonb_build_object('ok', false, 'reason', 'no_content'); end if;
  if p_day_index is distinct from v_day then return jsonb_build_object('ok', false, 'reason', 'stale_day'); end if;
  if public.five_steps_skipped(v_me, 'pass_on') then return jsonb_build_object('ok', false, 'reason', 'skipped'); end if;
  if (p_key = 'recall_story' and not exists (select 1 from public.recall_picks r where r.parent_id = v_me and r.session_date = v_today))
     or (p_key = 'choice_like' and not exists (select 1 from public.answers a where a.parent_id = v_me and a.session_date = v_today)) then
    return jsonb_build_object('ok', false, 'reason', 'missing_value');
  end if;
  insert into public.pass_on_picks (parent_id, family_id, session_date, day_index, line_key)
  values (v_me, v_family, v_today, v_day, p_key)
  on conflict (parent_id, session_date) do update set line_key = excluded.line_key, day_index = excluded.day_index, picked_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.save_pass_on(int, text) from public, anon;
grant execute on function public.save_pass_on(int, text) to authenticated;

-- ---- (4) 자녀 읽기: family_child_history(0050) + recalls·pass_ons ----
-- recalls  = [{session_date, label}]  — ② 고른 낱말
-- pass_ons = [{session_date, line_key, recall_label, choice_label, option_a, option_b}] — ⑤ 틀 키 + 끼울 값(그날 ②·③). 스위치 꺼짐이면 [].
--            끼울 값이 없어진 줄(recall_story인데 ② 없음, choice_like인데 ③ 답 없음)은 내보내지 않는다.
-- 둘 다 동의 중인 어르신만, 최근 30일(오늘 포함)·최신순·최대 30개(answers와 같은 창). answers 항목·키는 0050 그대로.
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
revoke execute on function public.family_child_history(uuid, uuid) from public, anon, authenticated, service_role;

-- ---- (5) 어르신 읽기 ----
-- get_today_content(0028) + skipped_steps·recall·pass_on. start_today는 이 함수를 그대로 감싼다(0024).
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

-- 미연결 열람(0024) + ② 보기(저장은 안 함 — 연결 전 답은 저장하지 않는다). 새 앱이 연결 전에도 5단계를 써 볼 수 있게.
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

-- parent_history(0028) + recall_label·pass_on_key(그날 저장된 것만, 없으면 null). 어르신 본인만.
create or replace function public.parent_history(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_days int := least(30, greatest(1, coalesce(p_days, 30)));
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  return jsonb_build_object('days', coalesce((
    select jsonb_agg(jsonb_build_object(
             'session_date', ds.session_date,
             'day_index', ds.day_index,
             'completed', ds.completed_at is not null,
             'photo', (select jsonb_build_object('caption', ph.caption, 'image_url', ph.image_url, 'keyword', ph.keyword)
                         from public.content_photos ph where ph.id = coalesce(ds.photo_id, ds.word_id)),
             'question', (select jsonb_build_object('prompt', q.prompt, 'option_a', q.option_a, 'option_b', q.option_b)
                            from public.content_questions q where q.id = ds.question_id),
             'choice_label', (select case a.choice when 'A' then q.option_a else q.option_b end
                                from public.answers a join public.content_questions q on q.id = a.question_id
                               where a.parent_id = v_me and a.question_id = ds.question_id and a.session_date = ds.session_date),
             'recall_label', (select o.label from public.recall_picks rp
                                join public.content_recall_options o on o.day_index = rp.day_index and o.slot = rp.slot
                               where rp.parent_id = v_me and rp.session_date = ds.session_date),
             'pass_on_key', (select po.line_key from public.pass_on_picks po
                              where po.parent_id = v_me and po.session_date = ds.session_date))
           order by ds.session_date desc)
      from public.daily_sessions ds
     where ds.parent_id = v_me
       and ds.session_date > public.kst_today() - v_days
       and (ds.photo_id is not null or ds.question_id is not null)), '[]'::jsonb));
end $$;

-- ---- (6) 이벤트 step 값: 0060 정의에서 step 정규식만 바꾼다(나머지 그대로) ----
create or replace function public.event_prop_ok(p_key text, p_val jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when p_key in ('ttl_hours', 'attempt_no', 'day_index', 'duration_sec', 'days_since_connect') then
      jsonb_typeof(p_val) = 'number' and (p_val #>> '{}') ~ '^[0-9]{1,7}$'
    when p_key in ('tts_used', 'is_first') then jsonb_typeof(p_val) = 'boolean'
    when jsonb_typeof(p_val) <> 'string' then false
    when p_key = 'message_key' then public.cheer_key_ok(p_val #>> '{}') -- 0060: 응원 키 목록은 cheer_key_ok 한 곳
    else (p_val #>> '{}') ~ case p_key
      when 'role_guess'      then '^(parent|child)$'
      when 'login_method'    then '^(kakao|google|email)$'
      when 'purpose'         then '^(parent_code|reconnect|sibling)$'
      when 'reason'          then '^(expired|used|locked|invalid|rate_limited|busy|already_linked|not_parent_device)$'
      when 'step'            then '^(photo|recall|question|hangul|pass_on|stop_here)$' -- 0061: ② recall·⑤ pass_on·여기까지 stop_here(값은 이름만, 낱말·문장 없음)
      when 'channel'         then '^(kakao|sms|copy|share_sheet|other)$'
      when 'result'          then '^(granted|denied|matched|kept|skipped|finished)$' -- 0053 finished(P6 낱말 쓰기)
      when 'consent_version' then '^v[0-9]{1,3}$'
      when 'app_version'     then '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(-[0-9]{1,6})?$'
      when 'install_source'  then '^[a-z][a-z0-9]{0,15}$' -- 영문으로 시작(숫자만인 번호 형식 차단)
      when 'source'          then '^(app_link|referrer|manual)$'
      when 'plan'            then '^(monthly|yearly|gift)$' -- 0034 C6 가격 3안
      when 'push_kind'       then '^(daily|cheer_arrived|parent_connected|parent_reconnected|parent_first_answer)$' -- 0034 = push_copy.kind, 0055 + parent_first_answer(0052)
      else '^$.' end -- 목록 밖 키: 어떤 값도 맞지 않음
  end
$$;
revoke execute on function public.event_prop_ok(text, jsonb) from public, anon, authenticated;
