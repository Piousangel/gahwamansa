-- 0069 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다. 파일 전체를 한 번에 실행한다(begin … commit, 한 트랜잭션).
-- 순서: 목록을 부르는 함수 둘을 이전 정의로(give_consent = 0035, parent_month_scope = 0068) → 목록 함수 삭제. 데이터 변경 없음.
-- 되돌린 뒤: give_consent는 다시 형식('v<1~3자리>')만 검사하고, 게이트는 목록 밖 저장 값(v999 등)도 정수 6 이상이면 통과한다.
--   v7 이상으로 범위를 넓힌 뒤라면 되돌리기 전에 목록 밖 저장 값 개수(0069 notice와 같은 SQL)를 먼저 확인한다.
-- 함수는 이전 정의 그대로 붙여 넣었다(create or replace라 권한은 그대로: give_consent는 authenticated만, parent_month_scope는 내부 전용).

begin;

create or replace function public.give_consent(p_version text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_prev_at timestamptz;
  v_prev_ver text;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  if p_version is null or p_version !~ '^v[0-9]{1,3}$' then raise exception 'invalid_version'; end if;
  select consented_at, consent_version into v_prev_at, v_prev_ver from public.profiles where id = v_me for update;
  if v_prev_at is not null and v_prev_ver is not distinct from p_version then
    return;
  end if;
  update public.profiles set consented_at = now(), consent_version = p_version where id = v_me;
  insert into public.consent_events (parent_id, family_id, action, version)
  values (v_me, public.my_family_id(), 'given', p_version);
end $$;

create or replace function public.parent_month_scope(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select p.consented_at is not null
           and (case when p.consent_version ~ '^v[0-9]{1,3}$' then substr(p.consent_version, 2)::int else 0 end) >= 6
      from public.profiles p
     where p.id = p_parent and p.role = 'parent'), false)
$$;

drop function public.consent_versions();

commit;
