-- 7단계: record_session_step, parent_streak, my_day_index 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 하루 코스 단계 기록의 멱등성(같은 날 2회 완료해도 연속일 동일), 연속일 계산(하루 유예, 끊김),
--             입력 검증, 오늘의 콘텐츠 순환(행 수 기준)
begin;
select plan(15);
delete from public.answers; delete from public.content_photos; delete from public.content_questions; -- 시드와 무관하게 동작(이 트랜잭션 안에서만, 마지막에 rollback)

insert into auth.users (id, aud, role, is_anonymous) values
  ('51000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('51000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 어르신1
  ('51000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);  -- 어르신2
insert into public.families (id, created_by) values ('5f000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, course_start_date) values
  ('5b000000-0000-0000-0000-0000000000c1', '51000000-0000-0000-0000-0000000000c1', '5f000000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('5b000000-0000-0000-0000-0000000000a1', '51000000-0000-0000-0000-0000000000a1', '5f000000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today() - 4),
  ('5b000000-0000-0000-0000-0000000000a2', '51000000-0000-0000-0000-0000000000a2', '5f000000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today()),
  ('5b000000-0000-0000-0000-0000000000a3', null, '5f000000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today()); -- 연속일 계산용(기기 없음)
-- 콘텐츠 3일분 (순환 테스트용: 행 수 N=3)
insert into public.content_questions (day_index, option_a, option_b) values (1, 'a', 'b'), (2, 'c', 'd'), (3, 'e', 'f');
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'x', 'x', 'x'), (2, 'x', 'x', 'x'), (3, 'x', 'x', 'x');
-- 0024부터 커서 기준: 어제 1일차를 열었으면 오늘은 2일차
update public.profiles set content_seq = 1, content_seq_date = public.kst_today() - 1 where id = '5b000000-0000-0000-0000-0000000000a1';

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~2. 첫 단계 기록: 완료 아님, 연속일 0
select pg_temp.act_as('51000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$ select public.record_session_step('photo', 60) $$, '어르신은 단계를 기록할 수 있다');
select is((select public.record_session_step('photo', 60)), '{"completed": false, "steps": ["photo"], "streak": 0}'::jsonb, '1단계만 하면 완료가 아니고 연속일은 0이다');

-- 3. 3단계를 모두 끝내면 완료되고 연속일 1
select public.record_session_step('question', 200);
select is((select public.record_session_step('hangul', 400)), '{"completed": true, "steps": ["hangul", "photo", "question"], "streak": 1}'::jsonb, '3단계를 끝내면 완료이고 연속일은 1이다');

-- 4~6. 같은 날 다시 완료해도 연속일·완료 시각·행 수가 그대로다
reset role;
create temp table t0 as select completed_at as c from public.daily_sessions where parent_id = '5b000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('51000000-0000-0000-0000-0000000000a1', true);
select is((select (public.record_session_step('hangul', 500)) ->> 'streak'), '1', '같은 날 두 번 완료해도 연속일은 1이다');
reset role;
select is((select completed_at from public.daily_sessions where parent_id = '5b000000-0000-0000-0000-0000000000a1'), (select c from t0), '완료 시각은 처음 값으로 유지된다');
select is((select count(*)::int from public.daily_sessions where parent_id = '5b000000-0000-0000-0000-0000000000a1'), 1, '하루에 행은 하나다');

-- 7~8. 입력 검증: 잘못된 단계, 자녀는 기록 불가
select pg_temp.act_as('51000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.record_session_step('foo', 10) $$, '%invalid_step%', '허용되지 않은 단계는 거부한다');
select pg_temp.act_as('51000000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.record_session_step('photo', 10) $$, '%parent_required%', '자녀는 단계를 기록할 수 없다');

-- 9~10. 소요 시간은 0~7200초로 제한된다
select pg_temp.act_as('51000000-0000-0000-0000-0000000000a2', true);
select public.record_session_step('photo', -5);
reset role;
select is((select duration_sec from public.daily_sessions where parent_id = '5b000000-0000-0000-0000-0000000000a2'), 0, '음수 소요 시간은 0으로 처리된다');
select pg_temp.act_as('51000000-0000-0000-0000-0000000000a2', true);
select public.record_session_step('question', 99999);
reset role;
select is((select duration_sec from public.daily_sessions where parent_id = '5b000000-0000-0000-0000-0000000000a2'), 7200, '너무 큰 소요 시간은 7200초로 제한된다');

-- 11~13. 연속일 계산: 하루 유예, 끊김
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps, completed_at) values
  ('5f000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-0000000000a3', public.kst_today() - 1, '{photo,question,hangul}', now()),
  ('5f000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-0000000000a3', public.kst_today() - 2, '{photo,question,hangul}', now()),
  ('5f000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-0000000000a3', public.kst_today() - 4, '{photo,question,hangul}', now()); -- 3일 전은 비어 있음
select is(public.parent_streak('5b000000-0000-0000-0000-0000000000a3', public.kst_today()), 2, '어제까지 이어졌으면 오늘 안 했어도 연속일이 유지된다(하루 유예), 중간이 끊기면 거기까지만 센다');
select is(public.parent_streak('5b000000-0000-0000-0000-0000000000a3', public.kst_today() + 1), 0, '이틀 이상 비면 연속일은 0이다');
select is(public.parent_streak('5b000000-0000-0000-0000-0000000000a2', public.kst_today()), 0, '완료한 적 없으면 0이다');

-- 14. 오늘의 콘텐츠 번호: 시작 후 4일째, 콘텐츠 3일분이면 (4 mod 3)+1 = 2
select pg_temp.act_as('51000000-0000-0000-0000-0000000000a1', true);
select is((select public.my_day_index()), 2, '커서 다음 콘텐츠가 오늘이다');

-- 15. 로그인 전(anon)은 실행할 수 없다
reset role;
set local role anon;
select throws_ok($$ select public.record_session_step('photo', 10) $$, '42501', null, '로그인 전 사용자는 실행할 수 없다');

select * from finish();
rollback;
