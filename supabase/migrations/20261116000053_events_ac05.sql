-- 0053 이벤트 AC-05(UX 깊이 회의 V10, DECISIONS 11-19 '측정')
-- 이름: course_step_started{step, day_index} — 단계별 이탈 = 시작 − 완료(첫날 목표 지표 '단계별 시작 대비 완료').
-- 속성: result 에 finished 추가 — P6 낱말 쓰기 완료는 finished/skipped 두 값만 보낸다(맞았는지·이대로 마쳤는지는 싣지 않음,
--       사람별 정오 기록 금지). 기존 granted·denied·matched·kept·skipped 는 그대로(옛 앱·0029 번호 채움 결과 호환).
-- 0022·0029·0034 규칙(키별 값 목록, 번호·문장 차단, 하루 200개)은 그대로이며 함수만 다시 정의한다.
-- 앱 계약 app/src/api/contract/events.ts 에 같은 값(__tests__/eventsContract.test.ts 가 이 파일을 읽어 비교).

create or replace function public.event_prop_ok(p_key text, p_val jsonb) returns boolean
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
      when 'result'          then '^(granted|denied|matched|kept|skipped|finished)$' -- 0053 finished(P6 낱말 쓰기)
      when 'message_key'     then '^(love_you|warm_day|thanks_always|peaceful_day)$'
      when 'consent_version' then '^v[0-9]{1,3}$'
      when 'app_version'     then '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(-[0-9]{1,6})?$'
      when 'install_source'  then '^[a-z][a-z0-9]{0,15}$' -- 영문으로 시작(숫자만인 번호 형식 차단)
      when 'source'          then '^(app_link|referrer|manual)$'
      when 'plan'            then '^(monthly|yearly|gift)$' -- 0034 C6 가격 3안
      when 'push_kind'       then '^(daily|cheer_arrived|parent_connected|parent_reconnected)$' -- 0034 = push_copy.kind
      else '^$.' end -- 목록 밖 키: 어떤 값도 맞지 않음
  end
$$;
revoke execute on function public.event_prop_ok(text, jsonb) from public, anon, authenticated;

create or replace function public.log_event(p_name text, p_props jsonb default '{}'::jsonb) returns jsonb
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
       'invite_share_tapped', 'consent_revoked', 'account_deleted', 'cheer_sent', 'push_permission_result',
       -- 연결 퍼널(0029, ease-and-joy 회의 E)
       'link_opened', 'referrer_found', 'code_prefilled',
       -- 빌드 1 추가(0034): C6 곧 유료, B1 사진 크게 보기, 전환 분모, 푸시 열기
       'paid_sheet_opened', 'paid_interest_tapped', 'photo_zoom_opened', 'child_first_answer_viewed', 'push_opened',
       -- AC-05(0053): 단계 시작(이탈 분모)
       'course_step_started') then
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
