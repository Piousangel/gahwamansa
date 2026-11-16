-- 0009 코드 리뷰(2026-11-17) 반영: 설계 근거 docs/plans/02-code-review-2026-11-17.md
-- 결정(사용자 승인): 재연결 코드 24시간·가입 코드 7일/6자리 유지, 답변은 회차별 이력 보존.

-- ---- 답변 이력: 회차(session_date)를 키에 포함 ----
alter table public.answers add column session_date date not null default public.kst_today();
alter table public.answers drop constraint answers_parent_id_question_id_key;
alter table public.answers add constraint answers_parent_question_day_key unique (parent_id, question_id, session_date);

create or replace function public.save_answer(p_question uuid, p_choice text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  if not public.my_consented() then raise exception 'consent_required'; end if;
  if p_choice is null or p_choice not in ('A', 'B') then raise exception 'invalid_choice'; end if;
  insert into public.answers (family_id, parent_id, question_id, choice, session_date)
  values (public.my_family_id(), public.my_profile_id(), p_question, p_choice, public.kst_today())
  on conflict (parent_id, question_id, session_date) do update set choice = excluded.choice, answered_at = now();
end $$;

-- ---- 콘텐츠 번호: day_index에 구멍이 있어도 존재하는 날 중에서 고른다 ----
create or replace function public.my_day_index() returns int
language sql stable security definer set search_path = ''
as $$
  with d as (
    select x.day_index, row_number() over (order by x.day_index) rn
      from (select p.day_index from public.content_photos p join public.content_questions q using (day_index)) x
  ), c as (select count(*) n from d)
  select (select d.day_index from d where d.rn = mod(greatest(0, public.kst_today() - pr.course_start_date), c.n) + 1)
    from public.profiles pr, c
   where pr.user_id = auth.uid() and c.n > 0
$$;

-- 오늘(KST) 답한 것만 answered_choice로 돌려준다.
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
                           and a.session_date = public.kst_today())
  );
end $$;

-- ---- 코드 발급: 재연결 24시간, 대상당 활성 1개, 가입 코드 5개 초과 시 가장 오래된 것 교체 ----
create or replace function public.issue_invite_code(p_target uuid default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
  v_me uuid := public.my_profile_id();
  v_code text;
  v_rows int;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if p_target is not null and not exists (
    select 1 from public.profiles where id = p_target and family_id = v_family and role = 'parent'
  ) then raise exception 'invalid_target'; end if;

  delete from public.invite_codes where expires_at < now() and used_at is null;

  if p_target is not null then
    delete from public.invite_codes where target_profile_id = p_target and used_at is null; -- 대상당 활성 재연결 코드는 1개
  else
    delete from public.invite_codes where id in (
      select id from public.invite_codes
       where family_id = v_family and used_at is null and target_profile_id is null
       order by expires_at desc, id  -- 최신 4개만 남기고(새 코드 포함 5개) 오래된 것을 정리
       offset 4
    );
  end if;

  for i in 1..5 loop
    v_code := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    insert into public.invite_codes (code, family_id, created_by, target_profile_id, expires_at)
    values (v_code, v_family, v_me, p_target,
            case when p_target is not null then now() + interval '24 hours' else now() + interval '7 days' end)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then return v_code; end if;
  end loop;
  raise exception 'code_generation_failed';
end $$;

-- ---- redeem: 전역 직렬화(병렬 우회 방지), 같은 기기 재시도 멱등, 재연결 성공 시 같은 대상의 다른 코드 무효화 ----
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

  -- 모든 redeem을 한 줄로 세운다: 집계 후 기록 사이의 틈을 막아 5회/300회 한도를 병렬로 우회하지 못하게 한다.
  -- (사용 빈도가 낮은 연결 흐름이라 직렬화 비용은 무시할 만하다.)
  perform pg_advisory_xact_lock(7001);

  -- 같은 기기가 이미 쓴 코드를 다시 보내면(응답 유실 후 재시도) 성공으로 돌려준다.
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
    -- 재연결에 성공하면 같은 어르신 대상의 다른 미사용 코드는 즉시 무효(탈취 방지)
    update public.invite_codes set expires_at = now() - interval '1 second'
     where target_profile_id = v_row.target_profile_id and used_at is null and id <> v_row.id;
  else
    insert into public.profiles (user_id, family_id, role) values (v_uid, v_row.family_id, 'parent') returning id into v_profile;
  end if;

  update public.invite_codes set used_at = now(), used_by = v_uid where id = v_row.id;
  insert into public.redeem_attempts (uid, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'family_id', v_row.family_id, 'profile_id', v_profile);
end $$;
