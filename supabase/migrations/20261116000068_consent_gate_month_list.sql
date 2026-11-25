-- 0068 부모님 동의 버전 게이트 + 자녀 홈 '최근 한 달 고르신 것'(기획 v2.1 0.1 '추가 게이트'·Q2·Q3·Q11, 0.5 [5]).
-- (1) 게이트 parent_month_scope(어르신): 답 공유 동의(consented_at)가 있고 그 동의 버전(consent_version)이 v6 이상이면 true.
--     지금까지 consent_version은 저장만 하고 비교하지 않았다(기획 0.3 정정 1). 버전 표기는 give_consent(0035)가 강제하는 'v<1~3자리>' 하나뿐이라
--     앞의 v를 떼고 정수로 비교한다(문자열 비교면 'v10' < 'v6'). 형식이 다르면(옛 null 등) 0 → false. 거절·철회(consented_at null)·미응답(v5 그대로)은 false.
--     기준 6은 이 함수 한 곳에만 둔다. 앱 CONSENT_VERSION을 v6으로 올리는 것은 다음 레인([6]) — 그 전에는 누구도 v6이 아니므로 반영해도 화면 변화 0.
-- (2) 새 범위 = ① 자녀 요약(family_child_summary)의 어르신 항목에 'month'(최근 한 달 고르신 것 사실 목록) ② 답 옆 '챙겨 드릴 거리'(care).
--     ① month: 게이트 true일 때만 키가 생긴다. false면 어르신 항목이 0067까지와 **글자 그대로 같다**(키 자체가 없음 — 옛 앱·v5 가족 무변화).
--        항목 모양 = family_child_history answers[] 그대로(session_date·prompt·prompt_short·option_a·option_b·choice_label·care). 날짜 내림차순만,
--        순위·횟수·묶음·갈래 없음(Q2 '순위 없음', Q3 '숫자 없음'). 기간 = family_child_history와 같은 D-29..D(KST) 30일·최대 30개 —
--        파기(0023 purge_expired_data: session_date < D-30 삭제)보다 하루 안쪽이라 31일 넘은 답은 지워지기 전에도 보이지 않는다.
--     ② care: care_lines_visible(0065)에 게이트를 더한다(0065 주석이 예고한 '이 함수 본문만 바꾼다'). 스위치(care_lines_enabled) AND v6 이상.
--        문장은 보기마다 미리 쓴 열(care_a·care_b) 중 고르신 쪽 하나 — 사람별로 모아 세거나 고르는 로직 없음(v6 문구 '풀이하지 않아요'의 전제).
--        그래서 v5·미응답 어르신은 스위치를 켜도 latest.care·answers[].care가 null(키는 0065대로 늘 있음).
-- (3) 새 자녀 RPC를 만들지 않고 family_child_summary를 넓혔다: 자녀 홈은 이미 child_summary 한 번으로 그린다(호출 1회 유지),
--     어르신 미리보기(parent_preview_child_view.summary, Q13 '실제 자녀 화면 미리 보기')가 같은 내부 함수라 따로 손대지 않아도 같은 게이트로 맞는다.
--     권한·잠금: 읽기 전용(잠금 없음). 새 함수는 security definer + search_path '' + 앱·anon·service_role 실행 불가(내부 전용, 0065 care_lines_visible과 같은 꼴).
--     content_questions care 열은 계속 definer 경로로만 읽힌다(0065 열 권한 그대로).
-- 되돌리기: supabase/down/20261116000068_consent_gate_month_list.down.sql

create function public.parent_month_scope(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select p.consented_at is not null
           and (case when p.consent_version ~ '^v[0-9]{1,3}$' then substr(p.consent_version, 2)::int else 0 end) >= 6
      from public.profiles p
     where p.id = p_parent and p.role = 'parent'), false)
$$;
revoke execute on function public.parent_month_scope(uuid) from public, anon, authenticated, service_role; -- 내부 전용

-- care_lines_visible(0065) + 동의 버전 게이트
create or replace function public.care_lines_visible(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.server_flag('care_lines_enabled') and public.parent_month_scope(p_parent) $$;
-- create or replace는 권한을 유지한다(0065: public·anon·authenticated·service_role 회수). 다시 한 번 명시.
revoke execute on function public.care_lines_visible(uuid) from public, anon, authenticated, service_role;

-- family_child_summary(0065) + parents[].month(게이트 true일 때만)
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
      ) || case when public.parent_month_scope(p.id) then jsonb_build_object( -- 0068: v6 이상만. 아니면 키 없음(0067과 같은 응답)
        'month', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'session_date', h.session_date,
                   'prompt', h.prompt,
                   'prompt_short', public.choice_pair_prompt(h.option_a, h.option_b),
                   'option_a', h.option_a,
                   'option_b', h.option_b,
                   'choice_label', case h.choice when 'A' then h.option_a else h.option_b end,
                   'care', case when public.care_lines_visible(p.id) then case h.choice when 'A' then h.care_a else h.care_b end end)
                 order by h.session_date desc, h.answered_at desc)
            from (select a.session_date, a.answered_at, a.choice, q.prompt, q.option_a, q.option_b, q.care_a, q.care_b
                    from public.answers a join public.content_questions q on q.id = a.question_id
                   where a.parent_id = p.id and a.session_date >= public.kst_today() - 29 -- family_child_history와 같은 창
                   order by a.session_date desc, a.answered_at desc
                   limit 30) h), '[]'::jsonb)) else '{}'::jsonb end
      order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = p_family and p.role = 'parent' and (p_parent is null or p.id = p_parent)), '[]'::jsonb))
$$;
revoke execute on function public.family_child_summary(uuid, uuid) from public, anon, authenticated, service_role; -- 0050 그대로(명시)
