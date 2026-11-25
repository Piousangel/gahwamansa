-- 0066 이벤트 child_home_viewed(기획 v2.1 측정 — docs/team/2026-11-26-plan-v2.md 0절, 성장 리뷰 3.1·3.2)
-- 자녀가 자녀 홈(C4)을 연 날 하루 한 번. 북극성 '양쪽이 닿은 가족'의 자녀 쪽 열람, 자녀 D7 재방문의 재료(metrics.sql ⑫·⑬).
-- 속성 없음: props 는 '{}' 만 받는다(다른 키를 실으면 invalid_props). 화면·답·날짜·계정 가명값 아무것도 싣지 않는다.
-- 하루 1회는 서버가 정한다: 같은 계정(device_key = uid 해시)·같은 KST 날짜(kst_today, 기기 시계 아님)에 이미 있으면
--   저장하지 않고 {ok:true}(앱은 성공으로 보고 다시 보내지 않음). 동시에 두 번 와도 한 행이 되게 계정별 잠금 뒤 확인한다.
--   앱(track.ts trackDaily)도 기기에서 KST 날짜로 거르지만 그건 요청 수를 줄이려는 것 — 정확성은 여기서 보장한다.
-- 0053 log_event 의 나머지 규칙(이름 목록, 키 8개, event_prop_ok, 하루 200개, 지워진 계정)은 그대로이고 함수만 다시 정의한다.
-- event_prop_ok 는 바꾸지 않는다(새 속성 키 없음). 앱 계약 app/src/api/contract/events.ts EVENT_NAMES 에 같은 이름(eventsContract.test 비교).

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
       'course_step_started',
       -- 기획 v2.1(0066): 자녀 홈 열람, KST 하루 1회·속성 없음
       'child_home_viewed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;
  if jsonb_typeof(v_props) <> 'object'
     or (select count(*) from jsonb_object_keys(v_props)) > 8
     or exists (select 1 from jsonb_each(v_props) e where not public.event_prop_ok(e.key, e.value))
     or (p_name = 'child_home_viewed' and v_props <> '{}'::jsonb) then -- 0066: 속성 없음
    return jsonb_build_object('ok', false, 'reason', 'invalid_props');
  end if;
  v_key := public.event_device_key(v_uid);
  if p_name = 'child_home_viewed' then
    -- 같은 계정의 동시 호출을 줄 세운 뒤(트랜잭션 끝에 풀림) 오늘(KST) 이미 있으면 저장 없이 성공
    perform pg_advisory_xact_lock(hashtextextended('child_home_viewed:' || v_key, 0));
    if exists (select 1 from public.events
                where device_key = v_key and name = 'child_home_viewed'
                  and ts >= (public.kst_today()::timestamp at time zone 'Asia/Seoul')) then
      return jsonb_build_object('ok', true);
    end if;
  end if;
  if (select count(*) from public.events where device_key = v_key and ts > now() - interval '24 hours') >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.events (family_id, profile_id, device_key, actor_role, name, props)
  values (public.my_family_id(), public.my_profile_id(), v_key, v_role, p_name, v_props);
  return jsonb_build_object('ok', true);
end $$;
