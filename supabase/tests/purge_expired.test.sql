-- 0023 테스트 (pgTAP): purge_expired_data 보관 기간 파기 + 일 배치 등록. 실행: npx supabase test db
-- 보호하는 것(DECISIONS 2026-11-17 보관 기간): 답·코스 기록은 회차(session_date)가 31일 지나면, 응원은 보낸 지 31일,
--             초대 번호는 사용·만료 후 30일, 번호 입력 시도 기록은 30일이 지나면 지운다. 경계 안쪽은 남긴다.
--             앱(authenticated·anon)은 파기 함수를 실행하지 못한다.
begin;
select plan(14);

insert into auth.users (id, aud, role, is_anonymous) values
  ('77000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('77000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('77f00000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('77b00000-0000-0000-0000-0000000000c1', '77000000-0000-0000-0000-0000000000c1', '77f00000-0000-0000-0000-000000000001', 'child', null),
  ('77b00000-0000-0000-0000-0000000000a1', '77000000-0000-0000-0000-0000000000a1', '77f00000-0000-0000-0000-000000000001', 'parent', now());
insert into public.content_questions (id, day_index, option_a, option_b) values
  ('77c00000-0000-0000-0000-000000000001', 29, 'a', 'b');
-- 답: 30일 전 회차(남김), 31일 전 회차(지움)
insert into public.answers (family_id, parent_id, question_id, choice, session_date, answered_at) values
  ('77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000a1', '77c00000-0000-0000-0000-000000000001', 'A', public.kst_today() - 30, now()),
  ('77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000a1', '77c00000-0000-0000-0000-000000000001', 'B', public.kst_today() - 31, now());
-- 코스 기록: 같은 경계
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps) values
  ('77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000a1', public.kst_today() - 30, '{photo}'),
  ('77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000a1', public.kst_today() - 31, '{photo}');
-- 응원: 30일 전(남김), 32일 전(지움)
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at) values
  ('77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000c1', '77b00000-0000-0000-0000-0000000000a1', 'love_you', now() - interval '30 days'),
  ('77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000c1', '77b00000-0000-0000-0000-0000000000a1', 'warm_day', now() - interval '32 days');
-- 초대 번호: 사용 31일 전(지움), 만료 31일 전(지움), 만료 29일 전(남김), 아직 유효(남김)
insert into public.invite_codes (code, family_id, created_by, expires_at, used_at) values
  ('770001', '77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000c1', now() - interval '20 days', now() - interval '31 days'),
  ('770002', '77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000c1', now() - interval '31 days', null),
  ('770003', '77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000c1', now() - interval '29 days', null),
  ('770004', '77f00000-0000-0000-0000-000000000001', '77b00000-0000-0000-0000-0000000000c1', now() + interval '3 days', null);
-- 입력 시도: 31일 전(지움), 29일 전(남김)
insert into public.redeem_attempts (uid, ok, at) values
  ('77000000-0000-0000-0000-0000000000a1', false, now() - interval '31 days'),
  ('77000000-0000-0000-0000-0000000000a1', false, now() - interval '29 days');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 앱은 실행 불가
select pg_temp.act_as('77000000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select public.purge_expired_data() $$, '42501', null, '로그인 사용자는 파기 함수를 실행하지 못한다');
reset role;
set local role anon;
select throws_ok($$ select public.purge_expired_data() $$, '42501', null, 'anon은 파기 함수를 실행하지 못한다');
reset role;

select ok((public.purge_expired_data() ->> 'answers')::int >= 1, '파기 결과에 지운 답 수가 있다');
select is((select array_agg(session_date order by session_date) from public.answers where parent_id = '77b00000-0000-0000-0000-0000000000a1'),
          array[public.kst_today() - 30], '답: 31일 지난 회차만 지운다');
select is((select array_agg(session_date order by session_date) from public.daily_sessions where parent_id = '77b00000-0000-0000-0000-0000000000a1'),
          array[public.kst_today() - 30], '코스 기록: 31일 지난 회차만 지운다');
select is((select array_agg(message_key) from public.cheers where to_parent = '77b00000-0000-0000-0000-0000000000a1'),
          array['love_you'], '응원: 31일 지난 것만 지운다');
select is((select array_agg(code::text order by code) from public.invite_codes where family_id = '77f00000-0000-0000-0000-000000000001'),
          array['770003', '770004'], '초대 번호: 사용·만료 후 30일 지난 것만 지운다');
select is((select count(*)::int from public.redeem_attempts where uid = '77000000-0000-0000-0000-0000000000a1'), 1, '입력 시도: 30일 지난 것만 지운다');
select is((public.purge_expired_data() ->> 'answers')::int, 0, '두 번 돌려도 더 지울 것이 없다(멱등)');

-- 기준 시각을 넘겨 경계 계산을 고정해 시험한다: 하루 뒤에는 30일 전 회차도 지워진다
select is((public.purge_expired_data(now() + interval '1 day') ->> 'answers')::int, 1, '하루 뒤 기준이면 다음 회차가 지워진다');
select is((select count(*)::int from public.profiles where family_id = '77f00000-0000-0000-0000-000000000001'), 2, '프로필·가족은 건드리지 않는다');

-- 일 배치 등록
select is((select count(*)::int from cron.job where jobname = 'purge-expired-data'), 1, 'pg_cron 일 배치가 등록돼 있다');
select is((select schedule from cron.job where jobname = 'purge-expired-data'), '10 15 * * *', '매일 15:10 UTC(= 00:10 KST)에 돈다');
select is((select command from cron.job where jobname = 'purge-expired-data'), 'select public.purge_expired_data()', '배치는 파기 함수를 부른다');

select * from finish();
rollback;
