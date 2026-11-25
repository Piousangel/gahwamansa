-- 0068 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다. 파일 전체를 한 번에 실행한다(begin … commit, 한 트랜잭션).
-- 순서: ① 스위치 care_lines_enabled 끄기 → ② 읽는 함수 둘을 0065 정의로(게이트 함수를 부르지 않게) → ③ 게이트 함수 삭제.
-- ①이 먼저인 까닭(#292 리뷰): 되돌린 뒤 care는 다시 스위치만 따른다 — 켜져 있으면 v5·미응답 어르신의 '챙겨 드릴 거리'까지 자녀에게 보인다.
--    그래서 같은 트랜잭션 맨 앞에서 끈다(행이 없으면 아무 일 없음 = 이미 꺼짐). 다시 켜는 것은 0068을 다시 올린 뒤 운영자 판단.
-- 데이터 변경은 ①의 스위치 한 줄뿐(consent_version 값은 그대로). 되돌린 뒤 자녀 요약에 month 키가 사라진다.
-- 함수는 0065 정의 그대로 붙여 넣었다(create or replace라 권한은 그대로: 둘 다 앱·anon·service_role 실행 불가).

begin;

-- ① 스위치 끄기(되돌린 뒤 care가 게이트 없이 보이지 않게)
update public.server_flags set enabled = false, updated_at = now() where name = 'care_lines_enabled';

-- ② 읽는 함수 둘을 0065 정의로
create or replace function public.care_lines_visible(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.server_flag('care_lines_enabled') and p_parent is not null $$;

create or replace function public.family_child_summary(p_family uuid, p_parent uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'parent_title', (select f.parent_title from public.families f where f.id = p_family),
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, (select f.parent_title from public.families f where f.id = p_family)),
        'connected', p.user_id is not null,
        'connected_date', (p.created_at at time zone 'Asia/Seoul')::date, -- 0041: 처음 연결된 날(KST)
        'shared', p.consented_at is not null,
        'latest', case when p.consented_at is null then null else (
          select jsonb_build_object(
            'prompt', q.prompt,
            'choice_label', case a.choice when 'A' then q.option_a else q.option_b end,
            'starter', case a.choice when 'A' then q.starter_a else q.starter_b end,
            'care', case when public.care_lines_visible(p.id) then case a.choice when 'A' then q.care_a else q.care_b end end, -- 0065
            'answered_date', a.session_date)
          from public.answers a join public.content_questions q on q.id = a.question_id
          where a.parent_id = p.id
          order by a.session_date desc, a.answered_at desc limit 1) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = p_family and p.role = 'parent' and (p_parent is null or p.id = p_parent)), '[]'::jsonb))
$$;

-- ③ 게이트 함수 삭제
drop function public.parent_month_scope(uuid);

commit;
