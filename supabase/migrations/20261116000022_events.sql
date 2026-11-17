-- 0022 이벤트(U14): 퍼널 8단계 측정용 최소 기록. 근거: docs/team/growth.md §3-1·3-2, docs/plans/10-master-plan.md ⑤ U14
-- 원칙: 이름은 정한 목록만(growth.md 3-1 퍼널 + "추가" 목록. 8단계 retained_d7은 SQL 파생이라 이름 없음).
--       속성(props)은 정한 키만, 값은 숫자·참거짓·짧은 영문 소문자 토큰(^[a-z0-9][a-z0-9_.-]{0,31}$)만 → 한글·띄어쓰기·자유 텍스트·답 내용이 들어갈 수 없다.
--       가족·프로필·역할은 서버가 호출한 사람 기준으로 채운다(user_id·이메일·기기 식별자는 저장하지 않음).
--       앱은 log_event로 쓰기만, 읽기는 서비스 역할(집계)만. 가족·프로필이 지워지면 이벤트도 지워진다(cascade).
-- 실패는 예외 대신 {ok:false, reason}: 계측 실패가 앱 흐름을 막지 않게.
-- 남은 일(이번 범위 밖): 서버 RPC 안에서의 자동 기록(child_signup_completed 등, growth.md "서버 측정"), 보관 14개월 파기, 호출 빈도 제한.

create table public.events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  family_id uuid references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  actor_role text not null check (actor_role in ('parent', 'child', 'none')),
  name text not null,
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object')
);
create index on public.events (name, ts);
create index on public.events (family_id, ts);
alter table public.events enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.events from public, anon, authenticated;
revoke all on sequence public.events_id_seq from public, anon, authenticated;
grant select on public.events to service_role;

create function public.log_event(p_name text, p_props jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
  v_role text := coalesce(public.my_role(), 'none');
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
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
     or exists (
       select 1 from jsonb_each(v_props) e
        where e.key not in ('role_guess', 'app_version', 'install_source', 'login_method', 'purpose', 'ttl_hours',
                            'reason', 'attempt_no', 'consent_version', 'step', 'day_index', 'duration_sec', 'tts_used',
                            'is_first', 'days_since_connect', 'channel', 'result', 'message_key')
           or not (jsonb_typeof(e.value) in ('number', 'boolean')
                   or (jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[a-z0-9][a-z0-9_.-]{0,31}$'))) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_props');
  end if;
  insert into public.events (family_id, profile_id, actor_role, name, props)
  values (public.my_family_id(), public.my_profile_id(), v_role, p_name, v_props);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.log_event(text, jsonb) from public, anon;
grant execute on function public.log_event(text, jsonb) to authenticated;
