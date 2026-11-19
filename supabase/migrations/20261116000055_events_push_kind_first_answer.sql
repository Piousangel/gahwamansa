-- 0055 이벤트 속성 push_kind 에 parent_first_answer 추가(PR #61 리뷰 L4).
-- 0052 가 새 알림 종류 parent_first_answer(자녀 '연결 뒤 첫 답', 채널 family)를 만들었으나 0053 event_prop_ok 의 push_kind 목록에 없어
-- 자녀가 그 알림을 눌렀을 때 push_opened{push_kind:'parent_first_answer'} 가 invalid_props 로 버려졌다.
-- event_prop_ok 만 다시 정의한다(log_event 이름·나머지 키 규칙은 0053 그대로). 앱 계약 app/src/api/contract/events.ts PUSH_KINDS 와 같다.

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
      when 'push_kind'       then '^(daily|cheer_arrived|parent_connected|parent_reconnected|parent_first_answer)$' -- 0034 = push_copy.kind, 0055 + parent_first_answer(0052)
      else '^$.' end -- 목록 밖 키: 어떤 값도 맞지 않음
  end
$$;
revoke execute on function public.event_prop_ok(text, jsonb) from public, anon, authenticated;
