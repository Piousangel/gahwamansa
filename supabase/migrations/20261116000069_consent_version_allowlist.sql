-- 0069 동의 문구 허용 버전 목록(대기열 66, #297 QA-1 후속).
-- 문제: give_consent(0035)는 형식('^v[0-9]{1,3}$')만 검사했다. 앱을 거치지 않고 'v999'를 직접 보낸 계정은
--       다음 버전(v7…)이 동의 범위를 넓히는 순간 0068 게이트(parent_month_scope — 정수 비교 6 이상)에 저절로 들어간다.
--       그 어르신은 넓어진 범위의 문구를 본 적이 없으므로 '본 문구에 동의'라는 증빙이 깨진다. 범위를 넓히기 전에 막는다.
-- (1) 허용 목록 consent_versions(): 서버가 정한 동의 문구 버전만. parent_titles()(0035)와 같은 꼴의 상수 함수 한 곳.
--     목록 = 앱 CONSENT_VERSION 이력(app/src/copy/copy.ts git log: v2 11-17 → v3 → v4 → v5 → v6 11-26) + v1(0012~0035 서버 기본값, 저장된 행이 있다).
--     옛 앱 빌드가 보내는 v2~v5도 계속 받는다(거절하면 옛 빌드의 동의 버튼이 오류가 된다). 게이트는 아래 (3)으로 v6 이상만이라 범위는 그대로.
--     새 문구 버전(v7)은 앱 CONSENT_VERSION을 올리기 **전에** 이 목록에 더하는 마이그레이션이 먼저 들어가야 한다(아니면 새 앱의 동의가 invalid_version).
-- (2) give_consent: 형식 검사 대신 목록 검사. 거절 오류는 그대로 'invalid_version'(앱 처리 변화 없음). 나머지 본문은 0035 그대로.
-- (3) parent_month_scope(0068): 저장 값이 목록 안에 있고 그 정수가 6 이상일 때만 true. 이미 저장된 목록 밖 값(v999 등)은 지우지 않고 게이트 미통과.
--     정수 비교는 그대로 둔다(목록에 v10이 들어와도 'v10' < 'v6' 문자열 비교 함정 없음).
-- (4) 데이터 변경 없음. 반영 때 목록 밖 저장 값 개수만 notice로 남긴다(profiles·consent_events). 0이 아니면 운영 점검에서 계정을 확인한다.
-- 권한: consent_versions는 내부 전용(앱·anon·service_role 실행 불가 — 부르는 두 함수가 security definer라 소유자 권한으로 읽는다).
--       give_consent·parent_month_scope는 create or replace라 기존 권한 그대로(아래에 다시 명시).
-- 되돌리기: supabase/down/20261116000069_consent_version_allowlist.down.sql

create function public.consent_versions() returns text[]
language sql immutable set search_path = ''
as $$ select array['v1', 'v2', 'v3', 'v4', 'v5', 'v6'] $$;
revoke execute on function public.consent_versions() from public, anon, authenticated, service_role; -- 내부 전용

create or replace function public.give_consent(p_version text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_prev_at timestamptz;
  v_prev_ver text;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  if p_version is null or not (p_version = any (public.consent_versions())) then raise exception 'invalid_version'; end if; -- 0069: 형식 → 목록
  select consented_at, consent_version into v_prev_at, v_prev_ver from public.profiles where id = v_me for update;
  if v_prev_at is not null and v_prev_ver is not distinct from p_version then
    return;
  end if;
  update public.profiles set consented_at = now(), consent_version = p_version where id = v_me;
  insert into public.consent_events (parent_id, family_id, action, version)
  values (v_me, public.my_family_id(), 'given', p_version);
end $$;
revoke execute on function public.give_consent(text) from public, anon; -- 0035 그대로(명시)
grant execute on function public.give_consent(text) to authenticated;

create or replace function public.parent_month_scope(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select p.consented_at is not null
           and (case when p.consent_version = any (public.consent_versions()) then substr(p.consent_version, 2)::int else 0 end) >= 6 -- 0069: 목록 밖이면 0
      from public.profiles p
     where p.id = p_parent and p.role = 'parent'), false)
$$;
revoke execute on function public.parent_month_scope(uuid) from public, anon, authenticated, service_role; -- 0068 그대로(내부 전용)

-- 목록 밖 저장 값 개수(데이터는 바꾸지 않는다)
do $$
declare
  v_profiles int;
  v_events int;
begin
  select count(*) into v_profiles from public.profiles
   where consent_version is not null and not (consent_version = any (public.consent_versions()));
  select count(*) into v_events from public.consent_events
   where version is not null and not (version = any (public.consent_versions()));
  raise notice '0069 consent_version 목록 밖 값: profiles %행, consent_events %행 (변경 없음, 게이트 미통과)', v_profiles, v_events;
end $$;
