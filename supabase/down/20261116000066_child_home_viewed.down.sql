-- 0066 되돌리기(수동): log_event 를 0053 정의로 다시 실행한다(child_home_viewed 이름·속성 없음 검사·자녀 역할 검사·KST 하루 1회 제거).
-- 테이블·event_prop_ok 변경 없음. 이미 쌓인 child_home_viewed 행은 그대로 둔다(14개월 보관 규칙대로 지워짐). 앱은 invalid_name 을 화면에 드러내지 않는다(개발 빌드 경고만, 하루 1번).

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
