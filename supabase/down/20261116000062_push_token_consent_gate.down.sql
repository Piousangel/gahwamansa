-- 0062 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: 이 파일을 위에서부터 실행. register_push_token은 0036, set_push_enabled는 0037, account_delete_core는 0058 정의로 돌아간다
--       (create or replace라 권한은 그대로).
-- 주의: 0062가 지운 토큰 행(받기 동의 없는 계정·철회한 계정)은 되살릴 수 없다 — 발송 대상이 아니었으므로 잃는 발송은 없고,
--       되돌린 뒤에는 앱이 다음 등록(앱 시작·앞으로 돌아올 때) 때 다시 넣는다.
-- 앱 영향: 0062 응답의 stored 키가 사라질 뿐 ok:true는 그대로라 앱 계약(parseRegisterPushToken)은 깨지지 않는다.

create or replace function public.register_push_token(p_token text, p_platform text default 'android') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_token is null or char_length(p_token) not between 20 and 4096 or p_token !~ '^[A-Za-z0-9_:-]+$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  if p_platform is null or p_platform not in ('android', 'ios') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_platform');
  end if;
  -- 이 기기(토큰)의 이전 계정 행은 연결 여부와 상관없이 먼저 지운다(M2)
  delete from public.device_tokens where token = p_token and user_id <> v_uid;
  if public.my_profile_id() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (v_uid, p_token, p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
  perform pg_advisory_xact_lock(hashtext('push_tokens:' || v_uid::text));
  delete from public.device_tokens
   where user_id = v_uid
     and token not in (select token from public.device_tokens where user_id = v_uid order by updated_at desc, token limit 5);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_push_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_enabled is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if public.my_profile_id() is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  update public.profiles
     set push_enabled = p_enabled,
         push_consented_at = case when p_enabled then coalesce(push_consented_at, now()) else null end
   where id = public.my_profile_id();
  return jsonb_build_object('ok', true, 'enabled', p_enabled);
end $$;

-- account_delete_core: 0058 정의 그대로(잠금 두 줄 제거)
create or replace function public.account_delete_core(p_profile uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
  v_scope text;
  v_parent_uids uuid[];
  v_review boolean;
begin
  select * into v_p from public.profiles where id = p_profile;
  if not found then return null; end if;
  perform 1 from public.families where id = v_p.family_id for update; -- 0043 L2: 같은 가족 동시 삭제를 줄 세움(마지막 자녀 판단 경쟁)
  select f.is_review into v_review from public.families f where f.id = v_p.family_id;

  if v_p.role = 'child' and not exists (
    select 1 from public.profiles where family_id = v_p.family_id and role = 'child' and id <> v_p.id
  ) then
    select coalesce(array_agg(user_id), '{}') into v_parent_uids
      from public.profiles where family_id = v_p.family_id and role = 'parent' and user_id is not null;
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_p.family_id and user_id is not null);
    delete from public.families where id = v_p.family_id;
    delete from public.events where device_key in (select public.event_device_key(u.id) from auth.users u where u.id = any (v_parent_uids) and u.is_anonymous); -- 0058: 지워지는 어르신 익명 계정의 연결 전 이용 기록
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
    delete from public.events where device_key = public.event_device_key(v_p.user_id); -- 0058: 프로필 없이 쌓인 이용 기록(연결 전 포함)
    delete from auth.users where id = v_p.user_id;
  end if;

  -- 0054: 식별자 없는 측정 기록(심사 가족 제외)
  if not coalesce(v_review, false) then
    begin
      insert into public.events (ts, family_id, profile_id, device_key, actor_role, name, props)
      values (date_trunc('hour', now()), null, null, null, v_p.role, 'account_deleted', jsonb_build_object('scope', v_scope, 'role', v_p.role));
    exception when others then
      raise warning 'account_deleted_event_failed: %', sqlstate; -- 측정 실패는 삭제를 막지 않는다
    end;
  end if;
  return jsonb_build_object('scope', v_scope);
end $$;
