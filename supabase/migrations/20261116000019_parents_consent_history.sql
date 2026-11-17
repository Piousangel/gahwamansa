-- 0019 어르신 여러 명 구분 · session_date 기준 · 동의 이력
-- 근거: docs/team/reviews/2026-11-17-design-session-review.md C항(높음: 어르신 2명이면 답이 섞임 / 중간: 동의 이력, 날짜 기준),
--       docs/plans/10-master-plan.md §2 ③ 서버 선행, DECISIONS "동의 v2(재동의 게이트 없음)".
-- (1) 어르신별 호칭: profiles.parent_title(없으면 가족 호칭 families.parent_title). 자녀가 set_parent_title_for로 정한다.
-- (2) child_summary: 어르신마다 parent_id·title을 함께 돌려주고, "최근 답"은 session_date(그 답의 날) 기준.
--     answered_at은 같은 날 답을 고치면 now()로 바뀌어(0014) 날짜·순서 기준으로 쓰면 안 된다.
-- (3) consent_events: 동의(버전)·철회 이력. 앱은 직접 읽고 쓰지 못한다(증빙용, 서비스 역할만).
--     give_consent는 새 동의이거나 버전이 바뀔 때만 시각을 새로 찍고 이력을 남긴다. v2는 형식 검증(^v[0-9]{1,3}$)으로 이미 허용.
--     계정 지우기 때는 프로필과 함께 지워진다(on delete cascade, "모두 지워져요" 약속과 일치).

alter table public.profiles
  add column parent_title text
  check (parent_title in ('엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'));
-- 0014에서 profiles 직접 읽기는 컬럼 단위 grant다. 호칭은 가족이 보는 값이라 읽기 허용.
grant select (parent_title) on public.profiles to authenticated;

create table public.consent_events (
  id bigserial primary key,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  action text not null check (action in ('given', 'withdrawn')),
  version text check (version ~ '^v[0-9]{1,3}$'),
  at timestamptz not null default now()
);
create index on public.consent_events (parent_id, at);
alter table public.consent_events enable row level security; -- 정책 없음 = 클라이언트 전면 거부
revoke all on public.consent_events from public, anon, authenticated;
revoke all on sequence public.consent_events_id_seq from public, anon, authenticated;

create or replace function public.give_consent(p_version text default 'v1') returns void
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
    return; -- 같은 버전 반복: 시각·이력 그대로
  end if;
  update public.profiles set consented_at = now(), consent_version = p_version where id = v_me;
  insert into public.consent_events (parent_id, family_id, action, version)
  values (v_me, public.my_family_id(), 'given', p_version);
end $$;

create or replace function public.withdraw_consent() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public.my_profile_id();
  v_prev_at timestamptz;
  v_prev_ver text;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  select consented_at, consent_version into v_prev_at, v_prev_ver from public.profiles where id = v_me for update;
  delete from public.answers where parent_id = v_me;
  update public.profiles set consented_at = null where id = v_me;
  if v_prev_at is not null then
    insert into public.consent_events (parent_id, family_id, action, version)
    values (v_me, public.my_family_id(), 'withdrawn', v_prev_ver);
  end if;
end $$;

-- 자녀가 보는 것: 어르신마다 {parent_id, title, shared, latest}. latest는 동의한 어르신의 session_date가 가장 늦은 답 1개.
create or replace function public.child_summary() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_family uuid := public.my_family_id();
  v_title text;
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  select f.parent_title into v_title from public.families f where f.id = v_family;
  return jsonb_build_object(
    'parent_title', v_title,
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, v_title),
        'shared', p.consented_at is not null,
        'latest', case when p.consented_at is null then null else (
          select jsonb_build_object(
            'prompt', q.prompt,
            'choice_label', case a.choice when 'A' then q.option_a else q.option_b end,
            'answered_date', a.session_date)
          from public.answers a join public.content_questions q on q.id = a.question_id
          where a.parent_id = p.id
          order by a.session_date desc, a.answered_at desc limit 1) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = v_family and p.role = 'parent'), '[]'::jsonb));
end $$;

-- 자녀가 어르신 한 분의 호칭을 정한다(닫힌 목록). 실패는 {ok:false, reason}.
create function public.set_parent_title_for(p_parent uuid, p_title text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'child' then raise exception 'child_required'; end if;
  if p_title is null or p_title not in ('엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_title');
  end if;
  update public.profiles set parent_title = p_title
   where id = p_parent and family_id = public.my_family_id() and role = 'parent';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_target');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.set_parent_title_for(uuid, text) from public, anon;
grant execute on function public.set_parent_title_for(uuid, text) to authenticated;
