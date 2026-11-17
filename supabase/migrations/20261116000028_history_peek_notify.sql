-- 0028 어르신 기록 보기·연결 쉽게(회의 docs/team/board/2026-11-17-ease-and-joy/SUMMARY.md "서버" 줄) + 호칭 중복 방지
-- (1) daily_sessions.photo_id·question_id·word_id: 그날 받은 콘텐츠. advance_content_cursor(start_today·record_session_step)가 채운다. 기존 행은 null.
--     낱말은 지금 사진의 keyword라 word_id = 사진 id(낱말 표가 생기면 FK만 바꾼다). 콘텐츠는 삭제 금지(0024)지만 픽스처 예외를 위해 on delete set null.
-- (2) parent_history(p_days 1~30, 기본 30): 어르신 본인만. 세션 행이 있는 날만(빈 날 없음), 최신순.
--     고른 것(choice_label)은 그날 저장된 답이 있을 때만 — 동의 거부(저장 안 함)·철회(삭제)한 날은 null. 어르신이 친 글자는 저장하지 않으므로 없다.
-- (3) get_today_content: 오늘 내 답 answered_choice(기존 확인) + answered_label(선택지 글자) 추가. start_today도 같은 객체.
-- (4) peek_invite_code(p_code): 연결 전 확인 화면(P1c)용. 호칭만 돌려주고 번호를 쓰지 않는다. redeem과 같은 잠금(7001)·기기 10분 5회·전역 300회 한도,
--     실패는 redeem_attempts에 기록(redeem 한도와 공유). 이유: invalid·expired·used·rate_limited·busy·not_parent_device.
-- (5) notification_queue: 연결·재연결 성공 시 'parent_connected' 한 줄(가족 단위, payload {parent_id, reconnect}, 번호 값 없음, 심사 가족 제외).
--     발송(자녀 푸시)은 푸시 단위(0029~)가 sent_at을 채운다. 앱 접근 불가(서비스 역할만). 30일 지나면 0023 배치가 지운다(purge 재정의).
-- (6) 호칭 중복: set_parent_title_for가 같은 가족의 다른 어르신과 같은 호칭(어르신별 호칭, 없으면 가족 호칭)으로 정하려 하면 duplicate_title.
--     연결(redeem) 때는 기본 호칭(가족 호칭)이 겹쳐도 허용 — 자녀가 바꿀 때까지 그대로 둔다(연결을 막지 않음).

alter table public.daily_sessions
  add column photo_id uuid references public.content_photos(id) on delete set null,
  add column question_id uuid references public.content_questions(id) on delete set null,
  add column word_id uuid references public.content_photos(id) on delete set null;

create table public.notification_queue (
  id bigserial primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('parent_connected')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on public.notification_queue (sent_at, created_at);
alter table public.notification_queue enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.notification_queue from public, anon, authenticated;
revoke all on sequence public.notification_queue_id_seq from public, anon, authenticated;
grant select, update on public.notification_queue to service_role;

-- advance_content_cursor(0024) + 콘텐츠 id 기록
create or replace function public.advance_content_cursor(p_profile uuid) returns boolean
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
  insert into public.daily_sessions as ds (family_id, parent_id, session_date, day_index, photo_id, question_id, word_id)
  select v_pr.family_id, p_profile, v_today, v_pr.content_seq, ph.id, q.id, ph.id
    from (select 1) one
    left join public.content_photos ph on ph.day_index = v_pr.content_seq
    left join public.content_questions q on q.day_index = v_pr.content_seq
  on conflict (parent_id, session_date) do update set
    day_index = coalesce(ds.day_index, excluded.day_index),
    photo_id = coalesce(ds.photo_id, excluded.photo_id),
    question_id = coalesce(ds.question_id, excluded.question_id),
    word_id = coalesce(ds.word_id, excluded.word_id);
  return v_adv;
end $$;

-- get_today_content(0010) + answered_label
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
    'answered_label', (select case a.choice when 'A' then q.option_a else q.option_b end from public.answers a
                          join public.content_questions q on q.id = a.question_id
                         where a.parent_id = public.my_profile_id() and q.day_index = v_idx
                           and a.session_date = public.kst_today()),
    'consented', public.my_consented(),
    'completed_steps', to_jsonb(coalesce((select ds.completed_steps from public.daily_sessions ds
                         where ds.parent_id = public.my_profile_id() and ds.session_date = public.kst_today()), '{}')),
    'streak', public.parent_streak(public.my_profile_id(), public.kst_today())
  );
end $$;

-- 어르신 본인만. {days:[{session_date, day_index, completed, photo{caption,image_url,keyword}, question{prompt,option_a,option_b}, choice_label|null}]}
create function public.parent_history(p_days int default 30) returns jsonb
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
                               where a.parent_id = v_me and a.question_id = ds.question_id and a.session_date = ds.session_date))
           order by ds.session_date desc)
      from public.daily_sessions ds
     where ds.parent_id = v_me
       and ds.session_date > public.kst_today() - v_days
       and (ds.photo_id is not null or ds.question_id is not null)), '[]'::jsonb));
end $$;
revoke execute on function public.parent_history(int) from public, anon;
grant execute on function public.parent_history(int) to authenticated;

-- 어르신 기기(익명)만. 번호를 쓰지 않고 호칭만. {ok:true, parent_title} | {ok:false, reason[, retry_after_sec]}
create function public.peek_invite_code(p_code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.invite_codes%rowtype;
  v_fails int;
  v_retry int;
  v_title text;
begin
  if v_uid is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_parent_device');
  end if;
  perform pg_advisory_xact_lock(7001); -- redeem과 같은 줄(한도 우회 방지)

  select count(*), greatest(1, ceil(extract(epoch from (min(at) + interval '10 minutes' - now())))::int)
    into v_fails, v_retry
    from public.redeem_attempts
   where uid = v_uid and not ok and at > now() - interval '10 minutes';
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'retry_after_sec', v_retry);
  end if;
  if (select count(*) from public.redeem_attempts where not ok and at > now() - interval '10 minutes') >= 300 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  if p_code is null or p_code !~ '^[0-9]{6}$' then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into v_row from public.invite_codes where code = p_code and used_at is null;
  if not found then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    if exists (select 1 from public.invite_codes where code = p_code and used_at is not null) then
      return jsonb_build_object('ok', false, 'reason', 'used');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_row.expires_at < now() then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_row.reusable and (v_row.disabled_at is not null
      or (select count(*) from public.profiles where family_id = v_row.family_id and role = 'parent') >= coalesce(v_row.max_uses, 5)) then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select coalesce(p.parent_title, f.parent_title) into v_title
    from public.families f left join public.profiles p on p.id = v_row.target_profile_id
   where f.id = v_row.family_id;
  return jsonb_build_object('ok', true, 'parent_title', v_title);
end $$;
revoke execute on function public.peek_invite_code(text) from public, anon;
grant execute on function public.peek_invite_code(text) to authenticated;

-- set_parent_title_for(0019) + 같은 가족 다른 어르신과 같은 호칭이면 duplicate_title
create or replace function public.set_parent_title_for(p_parent uuid, p_title text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if p_title is null or p_title not in ('엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_title');
  end if;
  if not exists (select 1 from public.profiles where id = p_parent and family_id = v_family and role = 'parent') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_target');
  end if;
  perform 1 from public.families where id = v_family for update; -- 같은 가족 호칭 변경을 줄 세움(동시 중복 방지)
  if exists (
    select 1 from public.profiles p join public.families f on f.id = p.family_id
     where p.family_id = v_family and p.role = 'parent' and p.id <> p_parent
       and coalesce(p.parent_title, f.parent_title) = p_title) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_title');
  end if;
  update public.profiles set parent_title = p_title where id = p_parent;
  return jsonb_build_object('ok', true);
end $$;

-- redeem_invite_code(0025) + 연결 성공 알림 큐 + 호칭 중복 방지
create or replace function public.redeem_invite_code(p_code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.invite_codes%rowtype;
  v_existing public.profiles%rowtype;
  v_profile uuid;
  v_fails int;
  v_retry int;
begin
  if v_uid is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_parent_device');
  end if;

  perform pg_advisory_xact_lock(7001);

  if p_code is not null and exists (select 1 from public.invite_codes where code = p_code and used_by = v_uid and used_at is not null) then
    select * into v_existing from public.profiles where user_id = v_uid;
    if found then
      return jsonb_build_object('ok', true, 'family_id', v_existing.family_id, 'profile_id', v_existing.id);
    end if;
  end if;

  select count(*), greatest(1, ceil(extract(epoch from (min(at) + interval '10 minutes' - now())))::int)
    into v_fails, v_retry
    from public.redeem_attempts
   where uid = v_uid and not ok and at > now() - interval '10 minutes';
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'retry_after_sec', v_retry);
  end if;
  if (select count(*) from public.redeem_attempts where not ok and at > now() - interval '10 minutes') >= 300 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  if p_code is null or p_code !~ '^[0-9]{6}$' then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_row from public.invite_codes where code = p_code and used_at is null for update;
  if not found then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    if exists (select 1 from public.invite_codes where code = p_code and used_at is not null) then
      return jsonb_build_object('ok', false, 'reason', 'used');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_row.expires_at < now() then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select * into v_existing from public.profiles where user_id = v_uid;
  if found then
    if v_existing.family_id = v_row.family_id and v_row.target_profile_id is null then
      return jsonb_build_object('ok', true, 'family_id', v_existing.family_id, 'profile_id', v_existing.id);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'already_linked');
  end if;

  if v_row.target_profile_id is not null then
    update public.profiles set user_id = v_uid where id = v_row.target_profile_id returning id into v_profile;
    if v_profile is null then
      insert into public.redeem_attempts (uid, ok) values (v_uid, false);
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    update public.invite_codes set expires_at = now() - interval '1 second'
     where target_profile_id = v_row.target_profile_id and used_at is null and id <> v_row.id;
  else
    -- 심사 재사용 번호: 꺼져 있거나 연결 수 상한에 닿았으면 일반 '없는 번호'와 같이 거부(상태를 드러내지 않음)
    if v_row.reusable and (v_row.disabled_at is not null
        or (select count(*) from public.profiles where family_id = v_row.family_id and role = 'parent') >= coalesce(v_row.max_uses, 5)) then
      insert into public.redeem_attempts (uid, ok) values (v_uid, false);
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    insert into public.profiles (user_id, family_id, role) values (v_uid, v_row.family_id, 'parent') returning id into v_profile;
    update public.invite_codes set expires_at = least(expires_at, now() - interval '1 second')
     where family_id = v_row.family_id and used_at is null and target_profile_id is null and id <> v_row.id and not reusable;
  end if;

  if not v_row.reusable then
    update public.invite_codes set used_at = now(), used_by = v_uid where id = v_row.id;
  end if;
  -- 연결 성공 → 자녀 알림 큐(발송은 푸시 단위 0029~). 번호 값은 넣지 않는다. 심사 가족은 알리지 않는다.
  if not exists (select 1 from public.families where id = v_row.family_id and is_review) then
    insert into public.notification_queue (family_id, kind, payload)
    values (v_row.family_id, 'parent_connected',
            jsonb_build_object('parent_id', v_profile, 'reconnect', v_row.target_profile_id is not null));
  end if;
  insert into public.redeem_attempts (uid, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'family_id', v_row.family_id, 'profile_id', v_profile);
end $$;

-- purge_expired_data(0023) + 알림 큐 30일
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int;
begin
  delete from public.answers where session_date < v_today - 30;
  get diagnostics n_answers = row_count;
  delete from public.daily_sessions where session_date < v_today - 30;
  get diagnostics n_sessions = row_count;
  delete from public.cheers where sent_at < p_now - interval '31 days';
  get diagnostics n_cheers = row_count;
  delete from public.invite_codes
   where used_at < p_now - interval '30 days'
      or (used_at is null and expires_at < p_now - interval '30 days');
  get diagnostics n_codes = row_count;
  delete from public.redeem_attempts where at < p_now - interval '30 days';
  get diagnostics n_attempts = row_count;
  delete from public.events where ts < p_now - interval '14 months';
  get diagnostics n_events = row_count;
  delete from public.notification_queue where created_at < p_now - interval '30 days';
  get diagnostics n_queue = row_count;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue);
end $$;
