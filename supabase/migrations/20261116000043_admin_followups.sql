-- 0043 관리자 삭제·콘텐츠 게시 리뷰 반영(docs/team/reviews/2026-11-18-admin-delete-review.md 1부 M1~M3·L1·L2·L4, 2부 C-M3·C-L1~L5; C-M1·C-M2는 스크립트)
-- M1 admin_audit: service_role의 insert·update·delete·truncate 회수(감사 대상인 스크립트가 기록을 고치거나 지우지 못하게). 쓰기는 postgres 소유 definer
--    (admin_* RPC)만, 1년 파기는 purge_expired_data 안에서만 트랜잭션 한정 설정으로. purge_expired_data는 미래 기준 시각을 거부(future_now) —
--    미래 p_now로 보관 데이터 전체를 지우는 경로 차단.
-- M2 리드 결정: admin_delete_answers는 그 어르신의 코스 이벤트(course_step_completed·course_completed·photo_zoom_opened)도 지운다(참여 기록 정의와 일치).
-- L1 account_delete_core는 service_role도 직접 못 부른다(감사 없는 삭제 차단). L2 같은 가족 동시 삭제는 families 행 잠금으로 줄 세움.
-- L4 admin_check_args는 예외를 던지므로 volatile.
-- C-L5 인자 순서 통일: 관리자 함수는 모두 (대상, 사유, 처리자). admin_publish_content·admin_retire_content를 같은 순서로 다시 만든다(0040 이름 인자 호출 기준).
-- C-M3·C-L2 admin_retire_content: 이미 은퇴면 already_retired(감사 없음), 은퇴 뒤 활성 날이 7일(content_runway 경보 기준)보다 적으면 too_few_active.
-- C-L1·C-L3 admin_publish_content: p_days null 거부, image_url은 공개 사진 버킷 주소(https?://<호스트>/storage/v1/object/public/content-photos/…jpg)만,
--    길이 상한(설명 60·낱말 20·질문 80·선택지 30·회상 질문 1~80자·최대 5개).
-- C-L4 service_role의 content 두 표 insert·delete·truncate 회수(게시는 RPC·감사로만). 사진 주소 갱신(update)은 upload-photos 때문에 남기고, 문구는 0024 트리거가 막는다.

revoke insert, update, delete, truncate on public.admin_audit from service_role;
revoke all on sequence public.admin_audit_id_seq from service_role;
revoke execute on function public.account_delete_core(uuid) from service_role;
alter function public.admin_check_args(text, text) volatile;
revoke insert, delete, truncate on public.content_photos, public.content_questions from service_role;

create or replace function public.admin_delete_answers(p_profile uuid, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
  v_answers int;
  v_sessions int;
  v_events int;
begin
  perform public.admin_check_args(p_reason, p_operator);
  select * into v_p from public.profiles where id = p_profile;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_p.role <> 'parent' then return jsonb_build_object('ok', false, 'reason', 'not_parent'); end if;
  perform 1 from public.profiles where id = p_profile for update;
  delete from public.answers where parent_id = p_profile;
  get diagnostics v_answers = row_count;
  delete from public.daily_sessions where parent_id = p_profile;
  get diagnostics v_sessions = row_count;
  delete from public.events where profile_id = p_profile and name in ('course_step_completed', 'course_completed', 'photo_zoom_opened');
  get diagnostics v_events = row_count;
  insert into public.admin_audit (operator, action, target_profile, target_family, reason, detail)
  values (btrim(p_operator), 'delete_answers', p_profile, v_p.family_id, btrim(p_reason),
          jsonb_build_object('answers', v_answers, 'sessions', v_sessions, 'events', v_events));
  return jsonb_build_object('ok', true, 'answers', v_answers, 'sessions', v_sessions, 'events', v_events);
end $$;

drop function public.admin_publish_content(jsonb, text, text);
create function public.admin_publish_content(p_days jsonb, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_max int;
  v_days int[];
  v_bad int;
  r jsonb;
begin
  perform public.admin_check_args(p_reason, p_operator);
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_item');
  end if;
  perform pg_advisory_xact_lock(hashtext('content_publish'));

  for r in select * from jsonb_array_elements(p_days) loop
    if coalesce(r ->> 'day_index', '') !~ '^[0-9]{1,6}$'
       or coalesce(r ->> 'image_url', '') !~ '^https?://[A-Za-z0-9.:-]+/storage/v1/object/public/content-photos/[A-Za-z0-9/_.-]+\.jpe?g$'
       or coalesce(char_length(btrim(r ->> 'caption')), 0) not between 1 and 60
       or coalesce(char_length(btrim(r ->> 'keyword')), 0) not between 1 and 20
       or coalesce(char_length(btrim(r ->> 'option_a')), 0) not between 1 and 30
       or coalesce(char_length(btrim(r ->> 'option_b')), 0) not between 1 and 30
       or coalesce(char_length(r ->> 'prompt'), 0) > 80
       or coalesce(char_length(r ->> 'starter_a'), 0) > 60 or coalesce(char_length(r ->> 'starter_b'), 0) > 60
       or (r ? 'recall_questions' and (jsonb_typeof(r -> 'recall_questions') <> 'array' or jsonb_array_length(r -> 'recall_questions') > 5
           or exists (select 1 from jsonb_array_elements_text(r -> 'recall_questions') q where char_length(btrim(q)) not between 1 and 80))) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_item', 'day_index', r ->> 'day_index');
    end if;
  end loop;

  select array_agg((x ->> 'day_index')::int order by (x ->> 'day_index')::int) into v_days from jsonb_array_elements(p_days) x;
  select (x ->> 'day_index')::int into v_bad from jsonb_array_elements(p_days) x
   where exists (select 1 from public.content_photos where day_index = (x ->> 'day_index')::int)
      or exists (select 1 from public.content_questions where day_index = (x ->> 'day_index')::int)
   limit 1;
  if v_bad is not null then return jsonb_build_object('ok', false, 'reason', 'day_exists', 'day_index', v_bad); end if;

  select greatest(coalesce((select max(day_index) from public.content_photos), 0), coalesce((select max(day_index) from public.content_questions), 0)) into v_max;
  if v_days <> array(select generate_series(v_max + 1, v_max + cardinality(v_days))) then
    return jsonb_build_object('ok', false, 'reason', 'not_append', 'day_index', v_days[1], 'expected_from', v_max + 1);
  end if;

  insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions)
  select (x ->> 'day_index')::int, x ->> 'image_url', btrim(x ->> 'caption'), btrim(x ->> 'keyword'),
         coalesce(array(select btrim(q) from jsonb_array_elements_text(coalesce(x -> 'recall_questions', '[]'::jsonb)) q), '{}')
    from jsonb_array_elements(p_days) x;
  insert into public.content_questions (day_index, option_a, option_b, prompt, starter_a, starter_b)
  select (x ->> 'day_index')::int, btrim(x ->> 'option_a'), btrim(x ->> 'option_b'), nullif(btrim(x ->> 'prompt'), ''),
         nullif(btrim(x ->> 'starter_a'), ''), nullif(btrim(x ->> 'starter_b'), '')
    from jsonb_array_elements(p_days) x;

  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'content_publish', btrim(p_reason), jsonb_build_object('days', to_jsonb(v_days)));
  return jsonb_build_object('ok', true, 'days', to_jsonb(v_days));
end $$;

drop function public.admin_retire_content(int, text, text);
create function public.admin_retire_content(p_day int, p_reason text, p_operator text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_active int;
begin
  perform public.admin_check_args(p_reason, p_operator);
  perform pg_advisory_xact_lock(hashtext('content_publish'));
  if not exists (select 1 from public.content_photos where day_index = p_day) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if exists (select 1 from public.content_photos where day_index = p_day and retired_at is not null)
     and exists (select 1 from public.content_questions where day_index = p_day and retired_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'already_retired');
  end if;
  select count(*) into v_active from public.content_photos p join public.content_questions q using (day_index)
   where p.retired_at is null and q.retired_at is null and p.day_index <> p_day;
  if v_active < 7 then
    return jsonb_build_object('ok', false, 'reason', 'too_few_active', 'active_after', v_active);
  end if;
  update public.content_photos set retired_at = now() where day_index = p_day and retired_at is null;
  update public.content_questions set retired_at = now() where day_index = p_day and retired_at is null;
  insert into public.admin_audit (operator, action, reason, detail)
  values (btrim(p_operator), 'content_retire', btrim(p_reason), jsonb_build_object('day_index', p_day));
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.admin_publish_content(jsonb, text, text), public.admin_retire_content(int, text, text) from public, anon, authenticated;
grant execute on function public.admin_publish_content(jsonb, text, text), public.admin_retire_content(int, text, text) to service_role;

-- account_delete_core(0042) + 가족 행 잠금(L2)
create or replace function public.account_delete_core(p_profile uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
  v_scope text;
  v_parent_uids uuid[];
begin
  select * into v_p from public.profiles where id = p_profile;
  if not found then return null; end if;
  perform 1 from public.families where id = v_p.family_id for update; -- 0043 L2: 같은 가족 동시 삭제를 줄 세움(마지막 자녀 판단 경쟁)

  if v_p.role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_p.family_id and role = 'child' and id <> v_p.id
  ) then
    select coalesce(array_agg(user_id), '{}') into v_parent_uids
      from public.profiles where family_id = v_p.family_id and role = 'parent' and user_id is not null;
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_p.family_id and user_id is not null);
    delete from public.families where id = v_p.family_id;
    delete from auth.users where id = any (v_parent_uids) and is_anonymous;
    v_scope := 'family';
  else
    if v_p.user_id is not null then
      delete from public.device_tokens where user_id = v_p.user_id;
    end if;
    delete from public.profiles where id = v_p.id;
    v_scope := v_p.role;
  end if;

  if v_p.user_id is not null then
    -- 0042: 인증 계정(식별자 cascade)을 지우기 전에 카카오 회원번호를 해제 큐에 넣는다
    insert into public.kakao_unlink_queue (kakao_user_id)
    select provider_id from auth.identities where user_id = v_p.user_id and provider = 'kakao';
    delete from auth.users where id = v_p.user_id;
  end if;
  return jsonb_build_object('scope', v_scope);
end $$;

-- purge_expired_data(0042) + 미래 기준 시각 거부(M1)
create or replace function public.purge_expired_data(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
  n_answers int; n_sessions int; n_cheers int; n_codes int; n_attempts int; n_events int; n_queue int; n_push_log int; n_push_runs int; n_tokens int; n_claims int; n_audit int; n_kakao int;
begin
  if p_now > now() + interval '1 minute' then raise exception 'future_now'; end if; -- 0043 M1
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
  delete from public.push_log where created_at < p_now - interval '31 days';
  get diagnostics n_push_log = row_count;
  delete from public.push_runs where run_at < p_now - interval '13 months';
  get diagnostics n_push_runs = row_count;
  delete from public.device_tokens where updated_at < p_now - interval '270 days';
  get diagnostics n_tokens = row_count;
  delete from public.push_claims where claimed_at < p_now - interval '31 days';
  get diagnostics n_claims = row_count;
  -- 감사 행은 1년 보관 후 이 배치만 지운다(트리거 예외는 이 트랜잭션 안에서만)
  perform set_config('bumo.allow_audit_purge', 'on', true);
  delete from public.admin_audit where at < p_now - interval '1 year';
  get diagnostics n_audit = row_count;
  perform set_config('bumo.allow_audit_purge', 'off', true);
  delete from public.kakao_unlink_queue where gave_up_at < p_now - interval '30 days' or enqueued_at < p_now - interval '30 days';
  get diagnostics n_kakao = row_count;
  return jsonb_build_object('answers', n_answers, 'daily_sessions', n_sessions, 'cheers', n_cheers,
                            'invite_codes', n_codes, 'redeem_attempts', n_attempts, 'events', n_events, 'notification_queue', n_queue,
                            'push_log', n_push_log, 'push_runs', n_push_runs,
                            'device_tokens', n_tokens, 'push_claims', n_claims, 'admin_audit', n_audit, 'kakao_unlink_queue', n_kakao);
end $$;
