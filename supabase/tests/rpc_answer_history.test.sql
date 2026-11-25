-- 0021 테스트 (pgTAP): child_answer_history, child_summary.connected. 실행: npx supabase test db
-- 보호하는 것: 자녀의 "지난 답"은 최근 30일(session_date 기준, 오늘 포함), 어르신별 최대 30개, 최신순,
--             동의한 어르신 것만(철회하면 즉시 0개), 본인 가족만. 개수·빈 날 집계는 주지 않는다.
--             연결이 끊긴 어르신은 connected=false로 구분된다.
begin;
select plan(23);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('75000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('75000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('75000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('75000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('75000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values
  ('75f00000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-0000000000c1'),
  ('75f00000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, user_id, family_id, role, consented_at, created_at) values
  ('75b00000-0000-0000-0000-0000000000c1', '75000000-0000-0000-0000-0000000000c1', '75f00000-0000-0000-0000-000000000001', 'child', null, now() - interval '9 days'),
  ('75b00000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000c2', '75f00000-0000-0000-0000-000000000002', 'child', null, now() - interval '9 days'),
  ('75b00000-0000-0000-0000-0000000000a1', '75000000-0000-0000-0000-0000000000a1', '75f00000-0000-0000-0000-000000000001', 'parent', now(), now() - interval '4 days'),
  ('75b00000-0000-0000-0000-0000000000a2', '75000000-0000-0000-0000-0000000000a2', '75f00000-0000-0000-0000-000000000001', 'parent', now(), now() - interval '3 days'),
  ('75b00000-0000-0000-0000-0000000000a3', '75000000-0000-0000-0000-0000000000a3', '75f00000-0000-0000-0000-000000000001', 'parent', null, now() - interval '2 days'), -- 미동의
  ('75b00000-0000-0000-0000-0000000000d1', null, '75f00000-0000-0000-0000-000000000001', 'parent', now(), now() - interval '1 days');                                     -- 연결 끊김
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('75c00000-0000-0000-0000-000000000001', 1, '가을', '봄', 'q1'),
  ('75c00000-0000-0000-0000-000000000002', 2, '바다', '산', 'q2');
-- 어르신1: 최근 30일 동안 하루 2개씩 60개 → 30개만
insert into public.answers (family_id, parent_id, question_id, choice, session_date)
select '75f00000-0000-0000-0000-000000000001', '75b00000-0000-0000-0000-0000000000a1', q, 'A', public.kst_today() - d
  from generate_series(0, 29) d, unnest(array['75c00000-0000-0000-0000-000000000001', '75c00000-0000-0000-0000-000000000002']::uuid[]) q;
-- 어르신2: 경계(29일 전은 포함, 30일 전은 제외)
insert into public.answers (family_id, parent_id, question_id, choice, session_date, answered_at) values
  ('75f00000-0000-0000-0000-000000000001', '75b00000-0000-0000-0000-0000000000a2', '75c00000-0000-0000-0000-000000000002', 'B', public.kst_today() - 29, now() - interval '29 days'),
  ('75f00000-0000-0000-0000-000000000001', '75b00000-0000-0000-0000-0000000000a2', '75c00000-0000-0000-0000-000000000001', 'A', public.kst_today() - 30, now()); -- 고친 시각은 최근이지만 회차는 30일 전
-- 미동의 어르신 답(원래 저장되지 않지만 있더라도 보이면 안 된다)
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('75f00000-0000-0000-0000-000000000001', '75b00000-0000-0000-0000-0000000000a3', '75c00000-0000-0000-0000-000000000001', 'A', public.kst_today());

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create function pg_temp.hist(p_parent text) returns jsonb language sql as $$
  select e from jsonb_array_elements((public.child_answer_history()) -> 'parents') e where e ->> 'parent_id' = p_parent
$$;
grant execute on function pg_temp.hist(text) to public;

select pg_temp.act_as('75000000-0000-0000-0000-0000000000c1', false);
select is(jsonb_array_length((public.child_answer_history()) -> 'parents'), 4, '가족의 어르신 4명이 따로 나온다');
select is(jsonb_array_length(pg_temp.hist('75b00000-0000-0000-0000-0000000000a1') -> 'answers'), 30, '어르신별 최대 30개');
select is((pg_temp.hist('75b00000-0000-0000-0000-0000000000a1') -> 'answers' -> 0 ->> 'session_date')::date, public.kst_today(), '최신순(오늘 먼저)');
select is((pg_temp.hist('75b00000-0000-0000-0000-0000000000a1') -> 'answers' -> 29 ->> 'session_date')::date, public.kst_today() - 14, '30개를 넘으면 오래된 것부터 빠진다');
select is(jsonb_array_length(pg_temp.hist('75b00000-0000-0000-0000-0000000000a2') -> 'answers'), 1, '30일 전 회차는 빠진다(고친 시각과 무관)');
select is((pg_temp.hist('75b00000-0000-0000-0000-0000000000a2') -> 'answers' -> 0 ->> 'session_date')::date, public.kst_today() - 29, '29일 전 회차는 들어간다');
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000a2') -> 'answers' -> 0,
          jsonb_build_object('session_date', public.kst_today() - 29, 'prompt', 'q2', 'prompt_short', '바다와 산 중',
                             'option_a', '바다', 'option_b', '산', 'choice_label', '산', 'care', null),
          '행은 날짜·질문·짧은 질문·선택지·고른 답 + care(0065, 스위치 꺼짐 = null)만');
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000a1') -> 'answers' -> 0 ->> 'prompt_short' in ('가을과 봄 중', '바다와 산 중'), true, '받침이 있으면 과, 없으면 와');
select is((select count(*)::int from jsonb_array_elements(pg_temp.hist('75b00000-0000-0000-0000-0000000000a1') -> 'answers') e
            where e ->> 'prompt_short' = '가을과 봄 중'), 15, '받침 있는 선택지는 "과"로 이어진다');
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000a3') -> 'answers', '[]'::jsonb, '미동의 어르신 답은 보이지 않는다');
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000a3') ->> 'shared', 'false', '미동의 어르신은 shared=false');
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000a1') ->> 'title', '부모님', '어르신별 호칭이 함께 온다');
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000d1') ->> 'connected', 'false', '연결 끊긴 어르신은 connected=false');
select is((select e ->> 'connected' from jsonb_array_elements((public.child_summary()) -> 'parents') e
            where e ->> 'parent_id' = '75b00000-0000-0000-0000-0000000000d1'), 'false', 'child_summary에도 connected=false');
select is((public.child_summary()) -> 'parents' -> 0 ->> 'connected', 'true', '연결된 어르신은 connected=true');

-- 철회 즉시 0개
select pg_temp.act_as('75000000-0000-0000-0000-0000000000a2', true);
select public.withdraw_consent();
select pg_temp.act_as('75000000-0000-0000-0000-0000000000c1', false);
select is(pg_temp.hist('75b00000-0000-0000-0000-0000000000a2') -> 'answers', '[]'::jsonb, '동의를 철회하면 즉시 보이지 않는다');

-- 남의 가족·권한
select pg_temp.act_as('75000000-0000-0000-0000-0000000000c2', false);
select is((public.child_answer_history()) -> 'parents', '[]'::jsonb, '다른 가족 자녀에게는 이 가족 어르신이 없다');
select pg_temp.act_as('75000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.child_answer_history() $$, '%child_required%', '어르신은 지난 답 목록을 호출할 수 없다');
reset role;
set local role anon;
select throws_ok($$ select public.child_answer_history() $$, '42501', null, 'anon은 child_answer_history를 실행하지 못한다');
reset role;
select is((select count(*)::int from public.answers where parent_id = '75b00000-0000-0000-0000-0000000000a1'), 60, '목록 조회는 저장된 답을 지우지 않는다(노출만 제한)');

-- 와/과: 마지막 글자의 받침으로(숫자는 읽는 소리로) 정한다(리뷰 L3)
select is(public.choice_pair_prompt('3', '4'), '3과 4 중', '숫자 3(삼)은 받침이 있어 과');
select is(public.choice_pair_prompt('2', '5'), '2와 5 중', '숫자 2(이)는 받침이 없어 와');
select is(public.choice_pair_prompt('10', '20'), '10과 20 중', '10(십)은 받침이 있어 과');

select * from finish();
rollback;
