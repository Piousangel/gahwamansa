-- 0003 RPC: 가족 생성, 초대 코드 발급. 설계 근거 docs/team/dev.md §4
-- 공통: security definer + search_path 고정, anon·public 실행 권한 제거, authenticated만 실행.

-- 자녀 가입 직후 호출: 가족, 자녀 프로필, 무료 기간 권한을 한 트랜잭션으로 만든다.
create function public.create_family() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_profile uuid;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'child_required';
  end if;
  if exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'already_has_profile';
  end if;

  insert into public.families (created_by) values (v_uid) returning id into v_family;
  insert into public.profiles (user_id, family_id, role) values (v_uid, v_family, 'child') returning id into v_profile;
  -- 무료 기간: 모든 기능 열림. 유료 전환 때 valid_until만 바꾼다.
  insert into public.entitlements (family_id, plan_id, source, valid_until) values (v_family, 'premium', 'free_period', null);

  return jsonb_build_object('family_id', v_family, 'profile_id', v_profile);
end $$;

-- 자녀만 호출. p_target이 있으면 "기존 어르신 재연결" 코드(같은 가족의 어르신이어야 함).
create function public.issue_invite_code(p_target uuid default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
  v_me uuid := public.my_profile_id();
  v_code text;
  v_rows int;
begin
  if public.my_role() is distinct from 'child' then
    raise exception 'child_required';
  end if;
  if p_target is not null and not exists (
    select 1 from public.profiles where id = p_target and family_id = v_family and role = 'parent'
  ) then
    raise exception 'invalid_target';
  end if;

  -- 만료분 정리(활성 코드 유일 인덱스 충돌 방지)
  delete from public.invite_codes where expires_at < now() and used_at is null;

  if (select count(*) from public.invite_codes where family_id = v_family and used_at is null) >= 5 then
    raise exception 'too_many_codes';
  end if;

  for i in 1..5 loop
    -- 암호학적 난수 4바이트를 6자리 숫자로
    v_code := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    insert into public.invite_codes (code, family_id, created_by, target_profile_id)
    values (v_code, v_family, v_me, p_target)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      return v_code;
    end if;
  end loop;
  raise exception 'code_generation_failed';
end $$;

revoke execute on function public.create_family() from public, anon;
revoke execute on function public.issue_invite_code(uuid) from public, anon;
grant execute on function public.create_family() to authenticated;
grant execute on function public.issue_invite_code(uuid) to authenticated;
