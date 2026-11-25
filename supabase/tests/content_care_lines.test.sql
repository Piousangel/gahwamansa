-- 0065 테스트 (pgTAP): '챙겨 드릴 거리'(content_questions.care_a·care_b). 실행: npx supabase test db
-- 보호하는 것: 값 검사(1~17자·금지어) / 게시된 행에도 문장을 채울 수 있고(0027 첫마디와 같은 예외) ③ 보기는 그대로 수정 금지 /
--             자녀 응답(child_summary.latest·child_answer_history.answers[])에 'care' 키 — 스위치 꺼짐(기본)이면 늘 null,
--             켜지면 고른 쪽 문장 하나만(고르지 않은 쪽 문장은 어디에도 없음), 동의 안 한 어르신은 그대로 빈 값 /
--             갈래·횟수 키 없음 / 보임 판단 함수는 앱이 못 부름 / 시드 1~14일 문장 28줄이 들어 있음 /
--             #286 QA-3 M1 효능·풀이 예시(띄어 쓴 것 포함)는 거부 / L1 앱 역할은 care 두 열을 표에서 직접 못 읽음(다른 열은 읽음).
begin;
select plan(23);

-- 시드(db reset) 확인: 1~14일 문장이 모두 채워져 있다
select is((select count(*)::int from public.content_questions where day_index between 1 and 14 and care_a is not null and care_b is not null), 14,
          '시드 1~14일에 챙겨 드릴 거리 28줄');

-- 값 검사
select lives_ok($$ update public.content_questions set care_a = '홍시 한 상자 챙겨 가기' where day_index = 4 $$, '게시된 행에도 문장을 고쳐 넣을 수 있다(0024 수정 금지 대상 아님)');
select throws_like($$ update public.content_questions set option_a = '곶감' where day_index = 4 $$, '%content_immutable%', '③ 보기는 그대로 수정 금지');
select throws_like($$ update public.content_questions set care_a = '가나다라마바사아자차카타파하가나다라' where day_index = 4 $$,
                   '%content_questions_care_a_ok%', '18자는 거부');
select throws_like($$ update public.content_questions set care_b = '건강 챙겨 드리기' where day_index = 4 $$,
                   '%content_questions_care_b_ok%', '금지어(건강)는 거부');
select throws_like($$ update public.content_questions set care_b = '' where day_index = 4 $$,
                   '%content_questions_care_b_ok%', '빈 문자열은 거부(없으면 null)');
select ok(public.care_line_ok(null) and public.care_line_ok('가까운 산골 마을 당일 나들이') and not public.care_line_ok('3일째 같이 걷기'),
          'null·17자 허용, N일째 거부');

select ok(not (select bool_or(public.care_line_ok(x)) from unnest(array['관절에 좋은 산책', '무릎에 좋은 걷기', '당뇨에 좋은 잡곡밥',
            '혈압 낮추는 나물', '면역력 높이는 차', '소화 잘되는 죽', '몸 에 좋은 차', '기 억 되살리기']) x),
          '효능·풀이 예시 8개는 모두 거부(공백을 지운 값으로 검사, QA-3 M1)');
select ok((select bool_and(public.care_line_ok(x)) from unnest(array['약과 한 접시', '약밥 지어 드리기', '약수터 산책',
            '연 높이 날리기', '허리띠 선물', '조약돌 줍기']) x)
          and not public.care_line_ok('약 챙겨 드리기') and not public.care_line_ok('명절에 좋아하시는 떡'),
          '낱말 단위 예외(약과·약밥·약수·조약·허리띠·높이 날)는 통과, 약·~에 좋아하시는은 그대로 거부(QA-3 재확인 L1)');

-- 열 단위 읽기 권한(QA-3 L1): 앱 역할은 care 두 열을 직접 못 읽는다. 다른 열·자녀 RPC(definer)는 그대로
set local role authenticated;
select throws_ok($$ select care_a from public.content_questions limit 1 $$, '42501', null, 'authenticated는 care_a를 직접 못 읽는다');
select throws_ok($$ select care_b from public.content_questions limit 1 $$, '42501', null, 'authenticated는 care_b를 직접 못 읽는다');
select lives_ok($$ select id, day_index, option_a, option_b, prompt, retired_at, starter_a, starter_b from public.content_questions limit 1 $$,
                'authenticated는 나머지 열은 그대로 읽는다'); -- rls:의도 열 권한 확인(행 수는 보지 않음)
reset role;
select ok(not has_table_privilege('anon', 'public.content_questions', 'select')
          and not has_column_privilege('anon', 'public.content_questions', 'prompt', 'select')
          and not has_column_privilege('anon', 'public.content_questions', 'care_a', 'select'),
          'anon은 이 표에 권한 0 그대로(0065가 새로 주지 않음, QA-3 재확인 M1)');

-- 픽스처
select set_config('bumo.allow_content_delete', 'on', true);
insert into auth.users (id, aud, role, is_anonymous) values
  ('70650000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70650000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70650000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values ('70650000-0000-0000-0000-0000000000f1', '70650000-0000-0000-0000-0000000000c1', '엄마');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('70650000-0000-0000-0000-00000000c001', '70650000-0000-0000-0000-0000000000c1', '70650000-0000-0000-0000-0000000000f1', 'child', null),
  ('70650000-0000-0000-0000-00000000a001', '70650000-0000-0000-0000-0000000000a1', '70650000-0000-0000-0000-0000000000f1', 'parent', now()),
  ('70650000-0000-0000-0000-00000000a002', '70650000-0000-0000-0000-0000000000a2', '70650000-0000-0000-0000-0000000000f1', 'parent', null);
insert into public.content_questions (id, day_index, option_a, option_b, prompt, care_a, care_b) values
  ('70650000-0000-0000-0000-0000000000d1', 9065, '단감', '홍시', '어느 맛이 더 좋으세요?', '단감 한 상자 챙겨 가기', '홍시 한 상자 챙겨 가기');
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('70650000-0000-0000-0000-0000000000f1', '70650000-0000-0000-0000-00000000a001', '70650000-0000-0000-0000-0000000000d1', 'B', public.kst_today()),
  ('70650000-0000-0000-0000-0000000000f1', '70650000-0000-0000-0000-00000000a002', '70650000-0000-0000-0000-0000000000d1', 'A', public.kst_today());

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create temp table r (k text primary key, v jsonb);
grant select, insert, update on r to authenticated;

-- 스위치 꺼짐(기본): 키는 있고 null
select pg_temp.act_as('70650000-0000-0000-0000-0000000000c1', false);
insert into r values ('sum_off', public.child_summary()), ('hist_off', public.child_answer_history());
reset role;
select ok((select v -> 'parents' -> 0 -> 'latest' ? 'care' from r where k = 'sum_off'), 'latest에 care 키가 있다(꺼짐이어도)');
select is((select v -> 'parents' -> 0 -> 'latest' -> 'care' from r where k = 'sum_off'), 'null'::jsonb, '스위치 꺼짐 → latest.care = null');
select is((select v -> 'parents' -> 0 -> 'answers' -> 0 -> 'care' from r where k = 'hist_off'), 'null'::jsonb, '스위치 꺼짐 → answers[].care = null');

-- 스위치 켬(운영자, postgres): 고른 쪽 문장 하나만
insert into public.server_flags (name, enabled) values ('care_lines_enabled', true);
select pg_temp.act_as('70650000-0000-0000-0000-0000000000c1', false);
insert into r values ('sum_on', public.child_summary()), ('hist_on', public.child_answer_history());
reset role;
select is((select v -> 'parents' -> 0 -> 'latest' ->> 'care' from r where k = 'sum_on'), '홍시 한 상자 챙겨 가기', '켬 → latest.care = 고른 쪽(B) 문장');
select is((select v -> 'parents' -> 0 -> 'answers' -> 0 ->> 'care' from r where k = 'hist_on'), '홍시 한 상자 챙겨 가기', '켬 → answers[].care = 고른 쪽 문장');
select ok((select position('단감 한 상자' in v::text) = 0 from r where k = 'sum_on')
          and (select position('단감 한 상자' in v::text) = 0 from r where k = 'hist_on'), '고르지 않은 쪽 문장은 응답 어디에도 없다');
select is((select v -> 'parents' -> 1 -> 'latest' from r where k = 'sum_on'), 'null'::jsonb, '동의 안 한 어르신은 그대로 latest = null');
select is((select v -> 'parents' -> 1 -> 'answers' from r where k = 'hist_on'), '[]'::jsonb, '동의 안 한 어르신은 그대로 answers = []');
select ok((select not (v::text ~ '(axis|category|갈래|count)') from r where k = 'hist_on'), '갈래·횟수 키를 돌려주지 않는다');

-- 보임 판단 함수는 앱·anon이 못 부른다
select ok(not has_function_privilege('authenticated', 'public.care_lines_visible(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.care_lines_visible(uuid)', 'execute')
          and not has_function_privilege('service_role', 'public.care_lines_visible(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.care_line_ok(text)', 'execute')
          and not has_function_privilege('anon', 'public.care_line_ok(text)', 'execute'),
          'care_lines_visible은 내부 전용(service_role도 불가), care_line_ok는 앱 역할 실행 불가(QA-1 L1)');

select * from finish();
rollback;
