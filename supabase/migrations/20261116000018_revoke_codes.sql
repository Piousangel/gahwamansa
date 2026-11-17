-- 0018 남은 가입 번호 무효화 (설계 세션 리뷰 2026-11-17 A항 높음)
-- 문제: 가족당 미사용 가입 번호가 최대 5개 살아 있고 연결에 쓴 1개만 사용 처리돼, 남은 번호로 7일간 다른 사람이 '부모'로 들어올 수 있었다.
-- (1) issue_invite_code: 새 가입 번호를 받으면 같은 가족의 이전 미사용 가입 번호를 만료 처리(가족당 살아 있는 가입 번호 1개).
-- (2) redeem_invite_code: 가입 성공 시 같은 가족의 나머지 미사용 가입 번호를 만료 처리.
-- 범위: 대상 지정 재연결 번호(target_profile_id)는 기존 규칙 유지(대상당 1개, 재연결 성공 시 같은 대상 번호 만료).
--       빌드 1은 번호 1개만(DECISIONS 2026-11-17 C2_codes 제외). 두 번째 어르신은 연결 뒤 새 번호를 받으면 된다(발급은 막지 않음).
-- 만료 처리는 행을 지우지 않고 expires_at 을 과거로: 어르신에게 'invalid'(번호 확인) 대신 'expired'(새 번호 받기)로 안내. 하루 뒤 발급 때 정리.

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

  -- 무효화(만료 처리)된 번호는 하루 동안 남겨 'expired'("가족에게 새 번호를 받아 주세요")로 안내하고, 그 뒤 정리한다
  delete from public.invite_codes where expires_at < now() - interval '1 day' and used_at is null;

  if p_target is not null then
    delete from public.invite_codes where target_profile_id = p_target and used_at is null; -- 대상당 활성 재연결 코드는 1개
  else
    -- 가입 번호는 가족당 살아 있는 것 1개: 새 번호를 받으면 이전 미사용 가입 번호는 바로 만료(남은 번호로 다른 사람이 들어오는 것 차단)
    update public.invite_codes set expires_at = least(expires_at, now() - interval '1 second')
     where family_id = v_family and used_at is null and target_profile_id is null;
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
    -- 가입 성공: 같은 가족의 남은 미사용 가입 번호는 즉시 만료(카톡 등으로 보낸 번호를 다른 사람이 쓰지 못하게)
    update public.invite_codes set expires_at = least(expires_at, now() - interval '1 second')
     where family_id = v_row.family_id and used_at is null and target_profile_id is null and id <> v_row.id;
  end if;

  update public.invite_codes set used_at = now(), used_by = v_uid where id = v_row.id;
  insert into public.redeem_attempts (uid, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'family_id', v_row.family_id, 'profile_id', v_profile);
end $$;
