-- 0025 스토어 심사용 접근: 심사 전용 가족 + 만료 없는 재사용 가입 번호
-- 근거: DECISIONS 2026-11-17 정책 문서 v2 리드 결정(A안 "심사 전용 가족 + 만료 없는 재사용 번호", 자녀 2명으로 가족 삭제 방지).
-- - families.is_review: 심사 가족 표시(앱이 바꿀 수 없음, 쓰기 정책 없음). 집계 때 제외용으로도 쓴다.
-- - invite_codes.reusable: 심사 가족에만 허용(트리거). 사용 처리하지 않아 여러 심사 기기가 같은 번호로 각자 어르신 프로필을 만든다.
--   0018의 "새 번호 발급·연결 성공 시 남은 가입 번호 만료"에서 제외. expires_at = infinity라 0023 파기 대상도 아니다.
-- - admin_create_review_family(자녀 auth id 배열): 서비스 역할 전용. 운영 스크립트(supabase/ops/create-review-access.mjs)가 부르고
--   번호는 출력만 한다. 번호·계정 값은 저장소·시드에 넣지 않고 Play 콘솔 "앱 액세스"에만 적는다.
-- 위험 수용: 재사용 번호를 아는 사람은 심사 가족에 어르신으로 들어올 수 있다 → 실제 사용자 데이터가 없는 가족이고, 운영자가 번호를 바꾸려면
--   기존 번호를 지우고(service role) 함수를 다시 부른다(새 가족). 시도 제한(10분 5회)은 그대로 적용된다.

alter table public.families add column is_review boolean not null default false;
alter table public.invite_codes add column reusable boolean not null default false;

create function public.invite_codes_reusable_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.reusable and not exists (select 1 from public.families f where f.id = new.family_id and f.is_review) then
    raise exception 'reusable_code_review_only';
  end if;
  return new;
end $$;
create trigger invite_codes_reusable_guard before insert or update on public.invite_codes
  for each row execute function public.invite_codes_reusable_guard();

-- issue_invite_code(0018) + 재사용 번호는 만료 처리에서 제외
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

-- redeem_invite_code(0018) + 재사용 번호는 사용 처리하지 않고, 다른 번호 만료 처리에서도 제외
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
    insert into public.profiles (user_id, family_id, role) values (v_uid, v_row.family_id, 'parent') returning id into v_profile;
    update public.invite_codes set expires_at = least(expires_at, now() - interval '1 second')
     where family_id = v_row.family_id and used_at is null and target_profile_id is null and id <> v_row.id and not reusable;
  end if;

  if not v_row.reusable then
    update public.invite_codes set used_at = now(), used_by = v_uid where id = v_row.id;
  end if;
  insert into public.redeem_attempts (uid, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'family_id', v_row.family_id, 'profile_id', v_profile);
end $$;

-- 서비스 역할 전용: 심사 가족(자녀 계정 1명 이상, 권장 2명) + 재사용 번호. 반환 {family_id, code}
create function public.admin_create_review_family(p_child_users uuid[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid;
  v_first uuid;
  v_uid uuid;
  v_code text;
  v_rows int;
begin
  if p_child_users is null or cardinality(p_child_users) < 1 then raise exception 'children_required'; end if;
  foreach v_uid in array p_child_users loop
    if not exists (select 1 from auth.users u where u.id = v_uid and not coalesce(u.is_anonymous, false)) then
      raise exception 'invalid_user';
    end if;
    if exists (select 1 from public.profiles where user_id = v_uid) then raise exception 'already_has_profile'; end if;
  end loop;

  insert into public.families (created_by, is_review) values (p_child_users[1], true) returning id into v_family;
  foreach v_uid in array p_child_users loop
    insert into public.profiles (user_id, family_id, role) values (v_uid, v_family, 'child');
  end loop;
  select id into v_first from public.profiles where family_id = v_family and user_id = p_child_users[1];
  insert into public.entitlements (family_id, plan_id, source, valid_until) values (v_family, 'premium', 'manual', null);

  for i in 1..5 loop
    v_code := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    insert into public.invite_codes (code, family_id, created_by, reusable, expires_at)
    values (v_code, v_family, v_first, true, 'infinity')
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then return jsonb_build_object('family_id', v_family, 'code', v_code); end if;
  end loop;
  raise exception 'code_generation_failed';
end $$;

revoke execute on function public.admin_create_review_family(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_create_review_family(uuid[]) to service_role;
