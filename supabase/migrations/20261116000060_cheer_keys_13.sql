-- 0060 응원(한마디) 키 확대 ② 서버 — 새 13키(docs/team/copy/2026-11-24-cheer-expansion.md 3·5절, DECISIONS 11-24 D-5: ans_seen 제외).
-- (1) public.cheer_key_ok(text): 응원 키 검사를 함수 하나로 모은다. 지금까지 같은 4키 목록이 세 곳에 복사돼 있었다.
--     - send_cheer 화이트리스트(0059) → cheer_key_ok
--     - cheer_texts.message_key check(0038) → cheer_key_ok
--     - 이벤트 message_key 정규식(event_prop_ok, 0055) → cheer_key_ok
--     목록은 함수 본문에 적는다(행 검사 아님). cheer_texts 행으로 검사하면 응원 문장 적재(법률 확인 뒤) 전에는 보내기가 모두 실패한다(라이터 5-2).
--     목록의 정본은 앱 계약 app/src/api/contract/cheers.ts CHEER_KEYS 하나다. 이 함수 목록은 app/__tests__/cheersContract.test.ts 가
--     마지막 정의를 읽어 글자까지 대조한다(load-push-copy.mjs·events.ts 는 CHEER_KEYS 를 그대로 가져다 쓴다).
-- (2) 기존 4키(love_you·warm_day·thanks_always·peaceful_day)는 지우지도 문장을 바꾸지도 않는다. 앱 시트에서 숨길 3키도 서버는 계속 받는다
--     (업데이트하지 않은 자녀 앱이 보내면 invalid_key 가 되지 않게, 안 읽은 한마디는 31일 남음).
-- (3) {답} 연동형(라이터 5-3)은 이번 범위 밖 — cheers·get_my_cheers 모양은 그대로다.
-- 배포 순서(DECISIONS 11-24): 어르신 앱 ①(#236, 모르는 키 기본 문장)이 스토어에 나간 뒤에만 staging/production 에 반영한다.
-- 응원 문장은 마이그레이션에 넣지 않는다 — docs/team/copy.ko.json cheers.* 가 원본이고 supabase/ops/load-push-copy.mjs 가 법률 리뷰 뒤 적재한다.
--   문장이 없는 키의 응원 알림은 0052 push_events_claim 이 body_many('응원이 {n}개 왔어요', n=1)로 보낸다 — 보내기·알림 모두 실패하지 않는다.

create function public.cheer_key_ok(p_key text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_key in (
    'love_you', 'warm_day', 'thanks_always', 'peaceful_day',
    'ans_me_too', 'ans_tell_more',
    'old_story', 'photo_memory', 'childhood_story',
    'call_soon', 'visit_soon', 'eat_together',
    'love', 'miss_you', 'thought_of_you',
    'doing_well', 'meal_thought'
  ), false)
$$;
revoke execute on function public.cheer_key_ok(text) from public, anon, authenticated;

-- (1-a) send_cheer: 0059 정의에서 키 검사 한 줄만 바꾼다(재시도 id·한도·잠금 순서 그대로)
create or replace function public.send_cheer(p_parent uuid, p_key text, p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_family uuid := public.my_family_id();
  v_target public.profiles%rowtype;
  v_id uuid;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if not public.cheer_key_ok(p_key) then -- 0060: 목록은 cheer_key_ok 한 곳
    return jsonb_build_object('ok', false, 'reason', 'invalid_key');
  end if;
  select * into v_target from public.profiles where id = p_parent and family_id = v_family and role = 'parent';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_target');
  end if;
  if v_target.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'disconnected');
  end if;
  perform 1 from public.profiles where id = v_me for update; -- 같은 자녀의 동시 전송을 줄 세워 한도 우회 방지(재시도 확인도 이 잠금 안에서)
  if p_request_id is not null then
    select id into v_id from public.cheers where from_child = v_me and request_id = p_request_id;
    if found then return jsonb_build_object('ok', true, 'cheer_id', v_id); end if; -- 0059: 같은 요청의 재시도
  end if;
  if (select count(*) from public.cheers
       where from_child = v_me and to_parent = p_parent
         and (sent_at at time zone 'Asia/Seoul')::date = public.kst_today()) >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;
  insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at, request_id)
  values (v_family, v_me, p_parent, p_key, clock_timestamp(), p_request_id)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'cheer_id', v_id);
end $$;
revoke execute on function public.send_cheer(uuid, text, uuid) from public, anon;
grant execute on function public.send_cheer(uuid, text, uuid) to authenticated;

-- (1-b) cheer_texts: 0038 의 인라인 check(이름 cheer_texts_message_key_check)를 cheer_key_ok 로
alter table public.cheer_texts drop constraint cheer_texts_message_key_check,
  add constraint cheer_texts_message_key_check check (public.cheer_key_ok(message_key));

-- (1-c) event_prop_ok: 0055 정의에서 message_key 정규식만 cheer_key_ok 로(나머지 키 규칙 그대로)
create or replace function public.event_prop_ok(p_key text, p_val jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when p_key in ('ttl_hours', 'attempt_no', 'day_index', 'duration_sec', 'days_since_connect') then
      jsonb_typeof(p_val) = 'number' and (p_val #>> '{}') ~ '^[0-9]{1,7}$'
    when p_key in ('tts_used', 'is_first') then jsonb_typeof(p_val) = 'boolean'
    when jsonb_typeof(p_val) <> 'string' then false
    when p_key = 'message_key' then public.cheer_key_ok(p_val #>> '{}') -- 0060: 응원 키 목록은 cheer_key_ok 한 곳
    else (p_val #>> '{}') ~ case p_key
      when 'role_guess'      then '^(parent|child)$'
      when 'login_method'    then '^(kakao|google|email)$'
      when 'purpose'         then '^(parent_code|reconnect|sibling)$'
      when 'reason'          then '^(expired|used|locked|invalid|rate_limited|busy|already_linked|not_parent_device)$'
      when 'step'            then '^(photo|question|hangul)$'
      when 'channel'         then '^(kakao|sms|copy|share_sheet|other)$'
      when 'result'          then '^(granted|denied|matched|kept|skipped|finished)$' -- 0053 finished(P6 낱말 쓰기)
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
