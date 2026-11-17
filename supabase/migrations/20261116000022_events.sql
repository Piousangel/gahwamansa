-- 0022 이벤트(U14): 퍼널 8단계 측정용 최소 기록. 근거: docs/team/growth.md §3-1·3-2, docs/plans/10-master-plan.md ⑤ U14
-- 원칙: 이름은 정한 목록만(growth.md 3-1 퍼널 + "추가" 목록. 8단계 retained_d7은 SQL 파생이라 이름 없음).
--       속성(props)은 정한 키만, 값은 키별 형식만(event_prop_ok): 숫자 키는 0 이상 정수, 참거짓 키는 boolean,
--       문자열 키는 허용 값 목록(enum) 또는 고정 형식(버전·동의 버전·유입 토큰) → 한글·문장(로마자 포함)·답 내용이 들어갈 수 없다(리뷰 L2).
--       가족·프로필·역할은 서버가 호출한 사람 기준으로 채운다. user_id·이메일은 저장하지 않는다.
--       device_key = auth uid의 sha256(가명). 기기당 호출 상한(24시간 200건, 가정값)에만 쓴다(리뷰 L1).
--       앱은 log_event로 쓰기만, 읽기는 서비스 역할(집계)만. 가족·프로필이 지워지면 이벤트도 지워진다(cascade).
--       보관: 14개월 지나면 0023 purge_expired_data가 지운다(가족 없는 기기 이벤트 포함).
-- 실패는 예외 대신 {ok:false, reason}: 계측 실패가 앱 흐름을 막지 않게.
-- 남은 일(범위 밖): 서버 RPC 안에서의 자동 기록(child_signup_completed 등, growth.md "서버 측정").

create table public.events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  family_id uuid references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  device_key text,
  actor_role text not null check (actor_role in ('parent', 'child', 'none')),
  name text not null,
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object')
);
create index on public.events (name, ts);
create index on public.events (family_id, ts);
create index on public.events (device_key, ts);
create index on public.events (ts);
alter table public.events enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.events from public, anon, authenticated;
revoke all on sequence public.events_id_seq from public, anon, authenticated;
grant select on public.events to service_role;

create function public.event_device_key(p_uid uuid) returns text
language sql immutable set search_path = ''
as $$ select encode(extensions.digest(p_uid::text, 'sha256'), 'hex') $$;
revoke execute on function public.event_device_key(uuid) from public, anon, authenticated;

-- 속성 한 개 검사: 키별 허용 형식
create function public.event_prop_ok(p_key text, p_val jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when p_key in ('ttl_hours', 'attempt_no', 'day_index', 'duration_sec', 'days_since_connect') then
      jsonb_typeof(p_val) = 'number' and (p_val #>> '{}') ~ '^[0-9]{1,7}$'
    when p_key in ('tts_used', 'is_first') then jsonb_typeof(p_val) = 'boolean'
    when jsonb_typeof(p_val) <> 'string' then false
    else (p_val #>> '{}') ~ case p_key
      when 'role_guess'      then '^(parent|child)$'
      when 'login_method'    then '^(kakao|google|email)$'
      when 'purpose'         then '^(parent_code|reconnect|sibling)$'
      when 'reason'          then '^(expired|used|locked|invalid|rate_limited|busy|already_linked|not_parent_device)$'
      when 'step'            then '^(photo|question|hangul)$'
      when 'channel'         then '^(kakao|sms|copy|share_sheet|other)$'
      when 'result'          then '^(granted|denied)$'
      when 'message_key'     then '^(love_you|warm_day|thanks_always|peaceful_day)$'
      when 'consent_version' then '^v[0-9]{1,3}$'
      when 'app_version'     then '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(-[0-9]{1,6})?$'
      when 'install_source'  then '^[a-z0-9]{1,16}$'
      else '^$.' end -- 목록 밖 키: 어떤 값도 맞지 않음
  end
$$;
revoke execute on function public.event_prop_ok(text, jsonb) from public, anon, authenticated;

create function public.log_event(p_name text, p_props jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
  v_role text := coalesce(public.my_role(), 'none');
  v_key text;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  -- 지워진 계정(0017·0026)의 남은 토큰으로는 기록하지 않는다
  if not exists (select 1 from auth.users where id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;
  if p_name is null or p_name not in (
       -- 퍼널 1~7단계
       'app_first_open', 'child_signup_completed', 'invite_code_issued',
       'parent_code_redeemed', 'parent_code_failed',
       'consent_shown', 'parent_consent_accepted', 'parent_consent_declined',
       'course_step_completed', 'course_completed', 'child_report_viewed',
       -- growth.md 3-1 "추가"
       'invite_share_tapped', 'consent_revoked', 'account_deleted', 'cheer_sent', 'push_permission_result') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;
  if jsonb_typeof(v_props) <> 'object'
     or (select count(*) from jsonb_object_keys(v_props)) > 8
     or exists (select 1 from jsonb_each(v_props) e where not public.event_prop_ok(e.key, e.value)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_props');
  end if;
  v_key := public.event_device_key(v_uid);
  if (select count(*) from public.events where device_key = v_key and ts > now() - interval '24 hours') >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.events (family_id, profile_id, device_key, actor_role, name, props)
  values (public.my_family_id(), public.my_profile_id(), v_key, v_role, p_name, v_props);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.log_event(text, jsonb) from public, anon;
grant execute on function public.log_event(text, jsonb) to authenticated;
