-- 0065 '챙겨 드릴 거리' 문장 열(기획 v2.1 콘텐츠 갈래 설계서 docs/team/2026-11-26-content-axes.md 5절, #283 설계·#285 라이터 확정)
-- (1) content_questions.care_a·care_b: ③ 짝의 보기 A·B마다 자녀가 해 볼 일 한 줄(명사구). **문장만** 저장한다 — 갈래(먹을거리·나들이…)와
--     결(물가·산들…)은 DB에 넣지 않는다(설계서 5절 추론 경계: 가족별로 세는 순간 성향 추론이 된다, 재동의 + L-13 뒤의 일).
--     null 허용(문장이 없는 날은 줄 없음). 값 검사 care_line_ok: 1~17자(라이터 확정 60줄 모두 17자 이하, 자녀 200% 2줄 목표),
--     금지어(copyBan BANNED_EVERYWHERE + guardrails 1절 + 설계서 W7 효능·풀이·기억 + W6 '몸에 좋')가 없을 것.
--     #286 QA-3 M1: 효능 꼴('~에 좋'·높이/낮추·잘되·되살)·병명·신체 부위(혈압·당뇨·관절·무릎·면역·소화 등)·'약'도 막고,
--     **공백을 모두 지운 값**으로 검사한다(띄어 써서 피하기 '몸 에 좋은'·'기 억' 차단 — 그래서 정규식 낱말에는 공백이 없다).
--     정본 목록과 막혀야 할 예시는 supabase/ops/content-care-seed.test.mjs·pgTAP content_care_lines 가 대조한다(두 목록 어긋남 방지).
-- (2) 게시 뒤 수정: 0024 content_immutable_guard는 day_index·option_a·option_b·prompt만 막는다. care_a·care_b는 그 목록에 넣지 않는다
--     = 첫마디(0027 starter_a/b)와 같은 꼴의 예외. 게시된 1~14일에 문장을 나중에 채울 수 있다(staging 재시드 범위의 UPDATE). 트리거는 바꾸지 않는다.
-- (3) 자녀 읽기: family_child_summary(latest)·family_child_history(answers 항목)에 'care' 키 — **어르신이 고른 쪽 문장 하나만**.
--     고르지 않은 쪽·갈래·횟수·묶음은 돌려주지 않는다. 보이는 조건은 care_lines_visible(어르신):
--       지금 = 서버 스위치 server_flags.care_lines_enabled(행 없음 = 꺼짐 → 늘 null). 다음 단계(P2 동의 v6 게이트)는 이 함수 본문만 바꾼다
--       ('그 어르신의 답 공유 동의가 v6 이상'을 더함 — 설계서 5절 '동의 버전 게이트'). 키는 늘 있고 꺼져 있으면 null(옛 자녀 앱은 모르는 키를 무시).
--     본문은 0050(family_child_summary)·0061(family_child_history) 정의 그대로 + care 줄만(차이는 PR 본문 diff).
--     어르신 본인 get_today_content는 바꾸지 않는다 — '챙겨 드릴 거리'는 자녀 화면 줄이다(설계서 2절, PR 결정 절).
-- 되돌리기: supabase/down/20261116000065_content_care_lines.down.sql

create function public.care_line_ok(p_line text) returns boolean
language sql immutable set search_path = ''
as $$ select p_line is null or (char_length(p_line) between 1 and 17
                                 and regexp_replace(p_line, '\s+', '', 'g') !~ '아직|못했|미완료|[0-9]+일째|틀렸|치매|치료|예방|효도|안부|안심|건강|뇌|노인|숙제|잘하셨|확인|지켜|실시간|효능|좋아하시니까|기억|몸에좋|에좋|높이|낮추|낮춰|잘되|되살|혈압|혈당|당뇨|관절|무릎|허리|면역|소화|변비|불면|약|뼈|근육|살빠|다이어트|피로') $$;

-- #286 QA-1 L1: 검사 함수는 앱 역할이 부를 일이 없다(0061 pass_on_key_ok와 같은 꼴 — 표 검사·서비스 역할 쓰기용으로 service_role은 남김)
revoke execute on function public.care_line_ok(text) from public, anon, authenticated;

alter table public.content_questions
  add column care_a text constraint content_questions_care_a_ok check (public.care_line_ok(care_a)),
  add column care_b text constraint content_questions_care_b_ok check (public.care_line_ok(care_b));

-- #286 QA-3 L1(리드 결정): 문장 열은 앱 역할이 표에서 직접 읽지 못하게 열 단위로 막는다 — 게이트(care_lines_visible)가
--   '앱 표시 약속'이 아니라 데이터 수준 차단이 되게. 표 단위 select를 회수하고 care 두 열을 뺀 열만 다시 준다(RLS 정책 questions_read는 그대로).
--   자녀·어르신 RPC는 security definer라 영향 없음. 앱(src)·Edge Function은 이 표를 직접 읽지 않는다(PR 본문 확인).
--   주의: 앞으로 이 표에 열을 더하면 앱에 보일 열은 따로 grant해야 한다(표 단위 select가 없으므로 자동으로 보이지 않음).
revoke select on public.content_questions from authenticated, anon;
grant select (id, day_index, option_a, option_b, prompt, retired_at, starter_a, starter_b) on public.content_questions to authenticated, anon;

-- 스위치 이름 추가(0061 목록 + care_lines_enabled). 마이그레이션은 행을 넣지 않는다 = 모든 환경 꺼짐.
alter table public.server_flags drop constraint server_flags_name_check,
  add constraint server_flags_name_check check (name in ('dev_reset_enabled', 'pass_on_store_enabled', 'care_lines_enabled'));

-- 그 어르신의 답 옆에 '챙겨 드릴 거리'를 보일지(내부). 지금은 스위치만. P2 v6 게이트는 이 함수에 더한다.
create function public.care_lines_visible(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.server_flag('care_lines_enabled') and p_parent is not null $$;
revoke execute on function public.care_lines_visible(uuid) from public, anon, authenticated, service_role; -- 내부 전용(0061 five_steps_skipped와 같은 꼴)

-- family_child_summary(0050) + latest.care
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

-- family_child_history(0061) + answers[].care
create or replace function public.family_child_history(p_family uuid, p_parent uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'parents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', p.id,
        'title', coalesce(p.parent_title, (select f.parent_title from public.families f where f.id = p_family)),
        'connected', p.user_id is not null,
        'shared', p.consented_at is not null,
        'answers', case when p.consented_at is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
                   'session_date', h.session_date,
                   'prompt', h.prompt,
                   'prompt_short', public.choice_pair_prompt(h.option_a, h.option_b),
                   'option_a', h.option_a,
                   'option_b', h.option_b,
                   'choice_label', case h.choice when 'A' then h.option_a else h.option_b end,
                   'care', case when public.care_lines_visible(p.id) then case h.choice when 'A' then h.care_a else h.care_b end end) -- 0065
                 order by h.session_date desc, h.answered_at desc)
            from (select a.session_date, a.answered_at, a.choice, q.prompt, q.option_a, q.option_b, q.care_a, q.care_b -- 0065: care 두 열
                    from public.answers a join public.content_questions q on q.id = a.question_id
                   where a.parent_id = p.id and a.session_date >= public.kst_today() - 29
                   order by a.session_date desc, a.answered_at desc
                   limit 30) h), '[]'::jsonb) end,
        'recalls', case when p.consented_at is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('session_date', r.session_date, 'label', r.label) order by r.session_date desc)
            from (select rp.session_date, o.label
                    from public.recall_picks rp
                    join public.content_recall_options o on o.day_index = rp.day_index and o.slot = rp.slot
                   where rp.parent_id = p.id and rp.session_date >= public.kst_today() - 29
                   order by rp.session_date desc
                   limit 30) r), '[]'::jsonb) end,
        'pass_ons', case when p.consented_at is null or not public.server_flag('pass_on_store_enabled') then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
                   'session_date', x.session_date, 'line_key', x.line_key, 'recall_label', x.recall_label,
                   'choice_label', x.choice_label, 'option_a', x.option_a, 'option_b', x.option_b)
                 order by x.session_date desc)
            from (select po.session_date, po.line_key,
                         (select o.label from public.recall_picks rp
                            join public.content_recall_options o on o.day_index = rp.day_index and o.slot = rp.slot
                           where rp.parent_id = po.parent_id and rp.session_date = po.session_date) recall_label,
                         (select case a.choice when 'A' then q.option_a else q.option_b end
                            from public.answers a join public.content_questions q on q.id = a.question_id
                           where a.parent_id = po.parent_id and a.session_date = po.session_date
                           order by a.answered_at desc limit 1) choice_label,
                         dq.option_a, dq.option_b
                    from public.pass_on_picks po
                    join public.daily_sessions ds on ds.parent_id = po.parent_id and ds.session_date = po.session_date
                    left join public.content_questions dq on dq.id = coalesce(ds.question_id,
                              (select q2.id from public.content_questions q2 where q2.day_index = po.day_index))
                   where po.parent_id = p.id and po.session_date >= public.kst_today() - 29
                   order by po.session_date desc
                   limit 30) x
           where (x.line_key <> 'recall_story' or x.recall_label is not null)
             and (x.line_key <> 'choice_like' or x.choice_label is not null)), '[]'::jsonb) end
      ) order by p.created_at, p.id)
      from public.profiles p
      where p.family_id = p_family and p.role = 'parent' and (p_parent is null or p.id = p_parent)), '[]'::jsonb))
$$;
