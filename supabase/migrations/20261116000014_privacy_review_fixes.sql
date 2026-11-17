-- 0014 독립 보안 검토 반영 (docs/team/reviews/2026-11-17-server-privacy-security.md)
-- 1) 응원: 자녀가 read_at(어르신이 앱을 연 시각)으로 참여 여부를 알 수 없게, 직접 읽기는 받는 어르신만
drop policy cheers_read on public.cheers;
create policy cheers_read on public.cheers for select to authenticated
  using (family_id = public.my_family_id() and to_parent = public.my_profile_id());

-- 2) 프로필: 동의 시각·버전·시작일은 직접 읽기 불가(가족 확인용 컬럼만). 판단은 security definer 함수가 한다
alter table public.profiles drop column consent_withdrawn_at; -- 어떤 로직도 쓰지 않고 철회/미동의 구분만 노출(과한 컬럼)
revoke select on public.profiles from authenticated;
grant select (id, user_id, family_id, role, display_name, created_at) on public.profiles to authenticated;

-- 3) 동의: 문구 버전 형식 검증, 행 잠금으로 철회와 저장의 경쟁 방지
create or replace function public.give_consent(p_version text default 'v1') returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  if p_version is null or p_version !~ '^v[0-9]{1,3}$' then raise exception 'invalid_version'; end if;
  perform 1 from public.profiles where id = public.my_profile_id() for update;
  update public.profiles set consented_at = coalesce(consented_at, now()), consent_version = p_version
   where id = public.my_profile_id();
end $$;

create or replace function public.withdraw_consent() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  perform 1 from public.profiles where id = public.my_profile_id() for update;
  delete from public.answers where parent_id = public.my_profile_id();
  update public.profiles set consented_at = null where id = public.my_profile_id();
end $$;

create or replace function public.save_answer(p_question uuid, p_choice text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then raise exception 'parent_required'; end if;
  perform 1 from public.profiles where id = public.my_profile_id() for update; -- 철회와 직렬화
  if not public.my_consented() then raise exception 'consent_required'; end if;
  if p_choice is null or p_choice not in ('A', 'B') then raise exception 'invalid_choice'; end if;
  insert into public.answers (family_id, parent_id, question_id, choice, session_date)
  values (public.my_family_id(), public.my_profile_id(), p_question, p_choice, public.kst_today())
  on conflict (parent_id, question_id, session_date) do update set choice = excluded.choice, answered_at = now();
end $$;
