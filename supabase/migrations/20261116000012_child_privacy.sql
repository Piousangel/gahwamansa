-- 0012 자녀 노출 범위 축소: 자녀는 answers·daily_sessions를 직접 읽지 못하고 child_summary() RPC로만 본다.
-- 동의 철회(withdraw_consent), 동의 문구 버전 기록, 호칭(닫힌 목록)을 추가한다. 근거: docs/plans/05-child-privacy-server.md

alter table public.families
  add column parent_title text not null default '부모님'
  check (parent_title in ('엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'));
alter table public.profiles
  add column consent_version text,
  add column consent_withdrawn_at timestamptz;

-- 읽기 권한: 본인(어르신)만. 자녀는 RPC로만.
drop policy answers_read on public.answers;
create policy answers_read on public.answers for select to authenticated
  using (family_id = public.my_family_id() and parent_id = public.my_profile_id());
drop policy sessions_read on public.daily_sessions;
create policy sessions_read on public.daily_sessions for select to authenticated
  using (family_id = public.my_family_id() and parent_id = public.my_profile_id());

-- 동의: 문구 버전 기록, 재동의 시 철회 시각을 비운다 (기존 give_consent()와 호출 호환)
drop function public.give_consent();
create function public.give_consent(p_version text default 'v1') returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  update public.profiles
     set consented_at = coalesce(consented_at, now()),
         consent_version = p_version,
         consent_withdrawn_at = null
   where id = public.my_profile_id();
end $$;

-- 철회: 저장된 답을 지우고 동의를 해제한다(세션 기록은 어르신 본인용으로 남고 자녀는 읽지 못한다)
create function public.withdraw_consent() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'parent_required';
  end if;
  delete from public.answers where parent_id = public.my_profile_id();
  update public.profiles
     set consented_at = null, consent_withdrawn_at = now()
   where id = public.my_profile_id();
end $$;

-- 자녀가 보는 것: 동의한 어르신의 "가장 최근 고른 답 + 날짜"만. 단계·연속일·시간·마지막 연 날짜는 없다.
create function public.child_summary() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'child' then
    raise exception 'child_required';
  end if;
  return jsonb_build_object(
    'parent_title', (select f.parent_title from public.families f where f.id = public.my_family_id()),
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'shared', p.consented_at is not null,
        'latest', case when p.consented_at is null then null else (
          select jsonb_build_object(
            'prompt', q.prompt,
            'choice_label', case a.choice when 'A' then q.option_a else q.option_b end,
            'answered_date', (a.answered_at at time zone 'Asia/Seoul')::date)
          from public.answers a join public.content_questions q on q.id = a.question_id
          where a.parent_id = p.id order by a.answered_at desc limit 1) end
      ) order by p.created_at)
      from public.profiles p
      where p.family_id = public.my_family_id() and p.role = 'parent'), '[]'::jsonb));
end $$;

create function public.set_parent_title(p_title text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'child' then
    raise exception 'child_required';
  end if;
  if p_title is null or p_title not in ('엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_title');
  end if;
  update public.families set parent_title = p_title where id = public.my_family_id();
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.give_consent(text), public.withdraw_consent(), public.child_summary(), public.set_parent_title(text) from public, anon;
grant execute on function public.give_consent(text), public.withdraw_consent(), public.child_summary(), public.set_parent_title(text) to authenticated;
