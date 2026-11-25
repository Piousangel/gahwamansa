-- 0062 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: 이 파일을 위에서부터 실행. register_push_token은 0036, set_push_enabled는 0037 정의로 돌아간다(create or replace라 권한은 그대로).
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
