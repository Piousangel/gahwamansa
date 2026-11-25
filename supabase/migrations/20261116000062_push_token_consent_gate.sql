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
--     등록은 동의 확인 전에 내 프로필 행을 잠가(for update) 철회와 동시에 와도 철회한 계정에 행이 남지 않는다(#264 리뷰 M1).
-- (3) 일회 정리: 지금 남아 있는 받기 동의 없는 계정의 토큰 행을 지운다(발송에 쓰인 적 없는 행).
-- (4) account_delete_core: 토큰 삭제 전에 프로필을 먼저 잠근다 — 잠금 순서 profiles → device_tokens 통일(QA-1 2차 M1). 아래 (4) 절.
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
  -- 내 프로필 행을 먼저 잠근다(#264 리뷰 M1): set_push_enabled의 update와 줄을 세운다. 잠그지 않으면
  --   R1 등록이 커밋 전일 때 철회가 끝나면 철회의 delete가 새 행을 못 보고, R2 철회가 커밋 전일 때 등록이 '켬'을 읽어 저장 → 철회한 계정에 행이 남는다.
  --   잠금 순서는 철회·삭제와 같다(profiles → device_tokens, QA-1 2차 M1 리드 결정). 아래에서 지울 수 있는 같은 토큰의 이전 계정 프로필도
  --   함께 user_id 순서로 잠근다. 연결 전(프로필 없음)이면 잠글 행이 없다.
  perform 1 from public.profiles
   where user_id = v_uid or user_id in (select dt.user_id from public.device_tokens dt where dt.token = p_token)
   order by user_id, id for update;
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

-- (4) account_delete_core(0058 본문 그대로 + 잠금 두 줄, QA-1 2차 M1 리드 결정): 토큰을 지우기 전에 관련 프로필 행을 먼저 잠근다.
--     잠금 순서를 profiles → device_tokens 하나로 통일한다(register_push_token·set_push_enabled와 같음). 0058 순서(토큰 → 프로필 삭제)는
--     등록·철회(프로필 → 토큰)와 반대라 동시에 오면 교착(deadlock detected)이 났다. 가족 전체 삭제는 여러 행이라 user_id 순서로 잠근다
--     (같은 가족 삭제끼리는 families 행 잠금(0043 L2)이 이미 줄 세움). 권한은 create or replace라 그대로.
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
    perform 1 from public.profiles where family_id = v_p.family_id order by user_id, id for update; -- 0062: 토큰보다 프로필 먼저(user_id 순서)
    delete from public.device_tokens
     where user_id in (select user_id from public.profiles where family_id = v_p.family_id and user_id is not null);
    delete from public.families where id = v_p.family_id;
    delete from public.events where device_key in (select public.event_device_key(u.id) from auth.users u where u.id = any (v_parent_uids) and u.is_anonymous); -- 0058: 지워지는 어르신 익명 계정의 연결 전 이용 기록
    delete from auth.users where id = any (v_parent_uids) and is_anonymous;
    v_scope := 'family';
  else
    perform 1 from public.profiles where id = v_p.id for update; -- 0062: 토큰보다 프로필 먼저
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

-- 일회 정리: 받기 동의가 없는 계정(프로필 없음 포함)의 토큰 행
delete from public.device_tokens dt
 where not exists (select 1 from public.profiles p
                    where p.user_id = dt.user_id and p.push_enabled and p.push_consented_at is not null);
