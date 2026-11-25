-- 0064 초대 번호 잠금 순서(#271 QA-1 L-a, 대기열 43). 가족 단위로 지우는 경로와 초대 번호 경로가 잠금을 반대로 잡아 교착했다.
-- 재현(supabase/ops/push-lock-race.sh, 0063까지): I1 심사 가족 정리 ↔ 재사용 번호 연결, I2 가족 전체 삭제 ↔ 1회용 번호 연결,
--   I3 자녀 본인 삭제(그 자녀가 만든 번호가 cascade로 지워짐) ↔ 같은 가족 다른 자녀의 번호 만들기 → 모두 deadlock detected.
-- 원인: 가족 단위 경로(admin_cleanup_review_family 0063·account_delete_core 0062)는 families FOR UPDATE → profiles → … → invite_codes
--   (disabled_at 갱신·families/profiles 삭제 cascade) 순서. 그런데
--   redeem_invite_code(0028)는 invite_codes 행 FOR UPDATE → profiles insert/update(insert의 FK 검사가 families에 KEY SHARE) 순서이고,
--   issue_invite_code(0025)는 같은 가족 invite_codes 갱신 → insert(FK 검사가 families에 KEY SHARE) 순서다. 즉 번호 → 가족으로 반대.
-- 규칙(dev-server-notes 잠금 순서 표): families → profiles → (device_tokens·invite_codes). 가족 행을 잡는 경로가 늘 먼저 families를 잡는다.
-- 고침: 두 함수 본문은 기존 정의 글자 그대로, 맨 앞쪽에 가족 행 KEY SHARE 한 줄씩만 더한다.
--   KEY SHARE: FK 검사가 어차피 잡는 가장 약한 잠금이라 번호 발급·연결끼리는 막지 않고(연결은 원래 advisory 7001로 줄 섬),
--   가족 정리·삭제의 FOR UPDATE와는 충돌해 그쪽이 끝날 때까지 기다린다(끝나면 번호가 지워졌거나 꺼져 있어 invalid 등 기존 응답).
--   redeem은 번호로 가족을 찾아 잠근다(같은 번호 값이 쓰인 행이 여럿이면 id 순서). 없는 번호면 잠글 것이 없고 기존 흐름대로 invalid.
-- 손대지 않은 번호 경로: admin_set_review_code·purge_expired_data(invite_codes만 씀), admin_create_review_family(새 가족 — 다른 연결이 못 봄).
-- 되돌리기: supabase/down/20261116000064_invite_lock_order.down.sql

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
  perform 1 from public.families f where f.id in (select ic.family_id from public.invite_codes ic where ic.code = p_code) order by f.id for key share; -- 0064: 가족 → 번호 순서

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
  perform 1 from public.families where id = v_family for key share; -- 0064: 가족 → 번호 순서

  delete from public.invite_codes where expires_at < now() - interval '1 day' and used_at is null;

  if p_target is not null then
    delete from public.invite_codes where target_profile_id = p_target and used_at is null;
  else
    update public.invite_codes set expires_at = least(expires_at, now() - interval '1 second')
     where family_id = v_family and used_at is null and target_profile_id is null and not reusable;
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
