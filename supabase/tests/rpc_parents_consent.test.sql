-- 0019 테스트 (pgTAP): 어르신 여러 명 구분, session_date 기준, 동의 이력. 실행: npx supabase test db
-- 보호하는 것: 어르신이 2명이면 child_summary가 어르신별(parent_id·호칭)로 나눠 답을 섞지 않는다,
--             "최근 답"은 답을 고친 시각(answered_at)이 아니라 그 답의 날(session_date) 기준이다,
--             동의·버전 변경·철회가 이력(consent_events)에 남고, 이력은 앱에서 직접 읽을 수 없다
begin;
select plan(27);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('73000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('73000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 다른 가족 자녀
  ('73000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 어르신1(먼저 연결)
  ('73000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),  -- 어르신2
  ('73000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true);  -- 다른 가족 어르신
insert into public.families (id, created_by) values
  ('73f00000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000c1'),
  ('73f00000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, user_id, family_id, role, consented_at, created_at) values
  ('73b00000-0000-0000-0000-0000000000c1', '73000000-0000-0000-0000-0000000000c1', '73f00000-0000-0000-0000-000000000001', 'child', null, now() - interval '3 days'),
  ('73b00000-0000-0000-0000-0000000000c2', '73000000-0000-0000-0000-0000000000c2', '73f00000-0000-0000-0000-000000000002', 'child', null, now() - interval '3 days'),
  ('73b00000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-0000000000a1', '73f00000-0000-0000-0000-000000000001', 'parent', null, now() - interval '2 days'),
  ('73b00000-0000-0000-0000-0000000000a2', '73000000-0000-0000-0000-0000000000a2', '73f00000-0000-0000-0000-000000000001', 'parent', null, now() - interval '1 days'),
  ('73b00000-0000-0000-0000-0000000000a3', '73000000-0000-0000-0000-0000000000a3', '73f00000-0000-0000-0000-000000000002', 'parent', null, now() - interval '1 days');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('73c00000-0000-0000-0000-000000000001', 1, '가을', '봄', 'q1'),
  ('73c00000-0000-0000-0000-000000000002', 2, '산', '바다', 'q2'),
  ('73c00000-0000-0000-0000-000000000003', 3, '국수', '밥', 'q3');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- ---- 동의 이력 ----
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a1', true);
select public.give_consent('v1');
select public.give_consent('v1'); -- 같은 버전 반복은 이력을 늘리지 않는다
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a2', true);
select public.give_consent('v2');
reset role;
select is((select count(*)::int from public.consent_events where parent_id = '73b00000-0000-0000-0000-0000000000a1'), 1, '같은 버전 동의를 두 번 해도 이력은 1건이다');
select is((select action || ':' || version from public.consent_events where parent_id = '73b00000-0000-0000-0000-0000000000a1'), 'given:v1', '이력에 동의와 문구 버전이 남는다');
select ok((select at is not null from public.consent_events where parent_id = '73b00000-0000-0000-0000-0000000000a1'), '이력에 시각이 남는다');

-- 버전이 바뀌면 동의 시각이 새로 찍히고 이력이 추가된다 (재동의 게이트 없음: v2를 그냥 받는다)
update public.profiles set consented_at = now() - interval '10 days' where id = '73b00000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$ select public.give_consent('v2') $$, 'v1 동의자가 v2로 동의한다');
reset role;
select is((select consented_at from public.profiles where id = '73b00000-0000-0000-0000-0000000000a1'), now(), '버전이 바뀌면 동의 시각이 갱신된다');
select is((select consent_version from public.profiles where id = '73b00000-0000-0000-0000-0000000000a1'), 'v2', '동의 버전이 v2가 된다');
select is((select array_agg(action || ':' || version order by id) from public.consent_events where parent_id = '73b00000-0000-0000-0000-0000000000a1'),
          array['given:v1', 'given:v2'], '버전 변경이 이력에 추가된다');

-- 이력은 앱(자녀·어르신)이 직접 읽거나 쓸 수 없다
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a1', true);
select throws_ok($$ select count(*) from public.consent_events $$, '42501', null, '어르신은 동의 이력을 직접 읽지 못한다');
select throws_ok($$ insert into public.consent_events (parent_id, family_id, action, version) values
  ('73b00000-0000-0000-0000-0000000000a1', '73f00000-0000-0000-0000-000000000001', 'given', 'v9') $$, '42501', null, '어르신은 동의 이력을 직접 쓰지 못한다');
select pg_temp.act_as('73000000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select count(*) from public.consent_events $$, '42501', null, '자녀는 동의 이력을 직접 읽지 못한다');

-- ---- 어르신별 답 구분 + session_date 기준 ----
reset role;
-- 어르신1: 3일 전 회차 답을 방금 고쳤고(answered_at 최신), 1일 전 회차 답은 5일 전에 저장된 것처럼 둔다
insert into public.answers (family_id, parent_id, question_id, choice, session_date, answered_at) values
  ('73f00000-0000-0000-0000-000000000001', '73b00000-0000-0000-0000-0000000000a1', '73c00000-0000-0000-0000-000000000001', 'A', public.kst_today() - 3, now()),
  ('73f00000-0000-0000-0000-000000000001', '73b00000-0000-0000-0000-0000000000a1', '73c00000-0000-0000-0000-000000000002', 'B', public.kst_today() - 1, now() - interval '5 days'),
  ('73f00000-0000-0000-0000-000000000001', '73b00000-0000-0000-0000-0000000000a2', '73c00000-0000-0000-0000-000000000003', 'A', public.kst_today(), now());

select pg_temp.act_as('73000000-0000-0000-0000-0000000000c1', false);
select is(jsonb_array_length((public.child_summary()) -> 'parents'), 2, '어르신 2명이 따로 나온다');
select is((public.child_summary()) -> 'parents' -> 0 ->> 'parent_id', '73b00000-0000-0000-0000-0000000000a1', '먼저 연결된 어르신이 첫째이고 parent_id가 있다');
select is((public.child_summary()) -> 'parents' -> 1 ->> 'parent_id', '73b00000-0000-0000-0000-0000000000a2', '둘째 어르신의 parent_id가 있다');
select is((public.child_summary()) -> 'parents' -> 0 -> 'latest' ->> 'choice_label', '바다', '최근 답은 session_date가 가장 늦은 답이다(고친 시각이 아님)');
select is(((public.child_summary()) -> 'parents' -> 0 -> 'latest' ->> 'answered_date')::date, public.kst_today() - 1, '최근 답 날짜는 session_date다');
select is((public.child_summary()) -> 'parents' -> 1 -> 'latest' ->> 'choice_label', '국수', '둘째 어르신의 답이 첫째와 섞이지 않는다');

-- 호칭: 기본은 가족 호칭, 어르신별로 따로 정할 수 있다
select is((public.child_summary()) -> 'parents' -> 0 ->> 'title', '부모님', '어르신별 호칭이 없으면 가족 호칭이 나온다');
select is((public.set_parent_title_for('73b00000-0000-0000-0000-0000000000a1', '엄마')) ->> 'ok', 'true', '자녀가 어르신1의 호칭을 정한다');
select is((public.set_parent_title_for('73b00000-0000-0000-0000-0000000000a2', '아빠')) ->> 'ok', 'true', '자녀가 어르신2의 호칭을 정한다');
select is((public.child_summary()) -> 'parents' -> 0 ->> 'title', '엄마', '어르신1 호칭이 나온다');
select is((public.child_summary()) -> 'parents' -> 1 ->> 'title', '아빠', '어르신2 호칭이 따로 나온다');
select is((public.set_parent_title_for('73b00000-0000-0000-0000-0000000000a1', '왕할머니')) ->> 'reason', 'invalid_title', '목록 밖 호칭은 거부된다');
select is((public.set_parent_title_for('73b00000-0000-0000-0000-0000000000a3', '엄마')) ->> 'reason', 'invalid_target', '다른 가족 어르신의 호칭은 바꿀 수 없다');

-- 남의 가족·권한
select pg_temp.act_as('73000000-0000-0000-0000-0000000000c2', false);
select is((select count(*)::int from jsonb_array_elements((public.child_summary()) -> 'parents') e
            where e ->> 'parent_id' in ('73b00000-0000-0000-0000-0000000000a1', '73b00000-0000-0000-0000-0000000000a2')), 0,
          '다른 가족 자녀의 요약에는 이 가족 어르신이 없다');
select pg_temp.act_as('73000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.set_parent_title_for('73b00000-0000-0000-0000-0000000000a1', '엄마') $$, '%child_required%', '어르신은 호칭을 정할 수 없다');

-- 철회: 이력에 남는다(동의 상태에서만)
select public.withdraw_consent();
select public.withdraw_consent(); -- 이미 철회된 상태의 반복은 이력을 늘리지 않는다
reset role;
select is((select array_agg(action order by id) from public.consent_events where parent_id = '73b00000-0000-0000-0000-0000000000a1'),
          array['given', 'given', 'withdrawn'], '철회가 이력에 한 번 남는다');

reset role;
set local role anon;
select throws_ok($$ select public.set_parent_title_for('73b00000-0000-0000-0000-0000000000a1', '엄마') $$, '42501', null, 'anon은 set_parent_title_for를 실행하지 못한다');

select * from finish();
rollback;
