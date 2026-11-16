-- 0004 RPC: 어르신 코드 사용(연결·재연결), 동의. 설계 근거 docs/team/dev.md §4
-- 핵심: 실패는 예외(raise)가 아니라 {ok:false, reason}으로 돌려줘야 시도 기록(redeem_attempts)이 롤백되지 않는다.

create function public.redeem_invite_code(p_code text) returns jsonb
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
  -- 어르신 기기(익명 로그인)만 사용 가능
  if v_uid is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_parent_device');
  end if;

  -- 기기(uid)당 10분 5회 실패 제한 (가정값, 공개 전 재검토)
  select count(*), greatest(1, ceil(extract(epoch from (min(at) + interval '10 minutes' - now())))::int)
    into v_fails, v_retry
    from public.redeem_attempts
   where uid = v_uid and not ok and at > now() - interval '10 minutes';
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'retry_after_sec', v_retry);
  end if;

  -- 전역 10분 300회 실패 상한 (가정값). 초과 시 정상 어르신도 잠시 막히는 트레이드오프를 수용.
  if (select count(*) from public.redeem_attempts where not ok and at > now() - interval '10 minutes') >= 300 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  if p_code is null or p_code !~ '^[0-9]{6}$' then
    insert into public.redeem_attempts (uid, ok) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- 동시에 같은 코드를 쓰려는 요청은 for update로 직렬화되고, 늦은 쪽은 'used'가 된다.
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
      -- 이미 이 가족에 연결된 기기: 멱등 성공(코드는 소모하지 않음)
      return jsonb_build_object('ok', true, 'family_id', v_existing.family_id, 'profile_id', v_existing.id);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'already_linked');
  end if;

  if v_row.target_profile_id is not null then
    -- 재연결: 같은 profiles.id에 user_id만 교체하므로 답변·세션 기록이 그대로 유지되고 이전 기기는 접근을 잃는다.
    update public.profiles set user_id = v_uid where id = v_row.target_profile_id returning id into v_profile;
    if v_profile is null then
      insert into public.redeem_attempts (uid, ok) values (v_uid, false);
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
  else
    insert into public.profiles (user_id, family_id, role) values (v_uid, v_row.family_id, 'parent') returning id into v_profile;
  end if;

  update public.invite_codes set used_at = now(), used_by = v_uid where id = v_row.id;
  insert into public.redeem_attempts (uid, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'family_id', v_row.family_id, 'profile_id', v_profile);
end $$;

-- 어르신이 "자녀에게 공개"에 동의. 이후 answers 저장이 가능해진다(RLS의 my_consented()).
create function public.give_consent() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  update public.profiles set consented_at = coalesce(consented_at, now()) where id = public.my_profile_id();
end $$;

revoke execute on function public.redeem_invite_code(text) from public, anon;
revoke execute on function public.give_consent() from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;
grant execute on function public.give_consent() to authenticated;
