-- 0062 받기 동의 전에는 푸시 토큰을 서버에 두지 않는다(QA-3 #262 리뷰 M2 개선안, 리드 채택).
-- 배경: Android 12 이하는 알림 권한이 기본 허용이라 역할만 고르면 앱(PushHost)이 FCM 토큰을 등록한다. 그런데 모든 발송 경로
--   (push_daily_eligible·push_reachable)는 알림 켬 + 받기 시각(push_consented_at, 0036)을 요구하므로, 받기 동의 전 토큰은
--   한 번도 발송에 쓰이지 않으면서 최대 270일(파기 배치 L3) 서버에 남았다. → 쓰지 않을 개인정보는 처음부터 받지 않는다.
-- (1) register_push_token: 형식 검사 → 같은 토큰의 다른 계정 행 삭제(0036 M2·리뷰 L4, 그대로) → 연결 전이면 no_profile(그대로)
--     → 받기 동의 전(알림 꺼짐 또는 받기 시각 없음)이면 이 계정 행도 지우고 저장하지 않는다. 응답은 {ok:true, stored:false}.
--     앱 계약(api/contract/push.ts parseRegisterPushToken)은 ok:true면 다른 키를 보지 않으므로 기존 앱이 깨지지 않는다.
--     동의 후 등록은 {ok:true, stored:true}(이전 {ok:true}에 키 하나 추가).
-- (2) set_push_enabled(false)(받기 철회): 받기 시각을 지우는 것(0037)에 더해 이 계정의 토큰 행을 모두 지운다 — "동의 없으면 보관 0"을
--     철회 뒤에도 같게. 다시 켜면(true) 앱이 바로 토큰을 다시 등록한다(pushClient.setReceive·childOptIn·acceptParentPrompt·FamilyPushRow,
--     다른 기기는 앞으로 올 때 PushHost sync). 반환 모양은 그대로.
-- (3) 일회 정리: 지금 남아 있는 받기 동의 없는 계정의 토큰 행을 지운다(발송에 쓰인 적 없는 행).
-- 되돌리기: supabase/down/20261116000062_push_token_consent_gate.down.sql

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
  -- 이 기기(토큰)의 이전 계정 행은 연결·동의 여부와 상관없이 먼저 지운다(0036 M2, 리뷰 L4: 해제 못 한 이전 계정 알림 차단)
  delete from public.device_tokens where token = p_token and user_id <> v_uid;
  if public.my_profile_id() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  -- 0062: 받기 동의 전이면 저장하지 않는다(발송 조건 push_reachable과 같은 기준). 남아 있던 같은 토큰 행도 지운다
  if not exists (select 1 from public.profiles
                  where user_id = v_uid and push_enabled and push_consented_at is not null) then
    delete from public.device_tokens where token = p_token;
    return jsonb_build_object('ok', true, 'stored', false);
  end if;
  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (v_uid, p_token, p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
  perform pg_advisory_xact_lock(hashtext('push_tokens:' || v_uid::text));
  delete from public.device_tokens
   where user_id = v_uid
     and token not in (select token from public.device_tokens where user_id = v_uid order by updated_at desc, token limit 5);
  return jsonb_build_object('ok', true, 'stored', true);
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
  if not p_enabled then
    delete from public.device_tokens where user_id = auth.uid(); -- 0062: 철회하면 이 계정 토큰도 보관하지 않는다
  end if;
  return jsonb_build_object('ok', true, 'enabled', p_enabled);
end $$;

-- 일회 정리: 받기 동의가 없는 계정(프로필 없음 포함)의 토큰 행
delete from public.device_tokens dt
 where not exists (select 1 from public.profiles p
                    where p.user_id = dt.user_id and p.push_enabled and p.push_consented_at is not null);
