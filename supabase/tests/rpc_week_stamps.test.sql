-- 이번 주 도장 줄 테스트 (pgTAP). 기준일을 고정해 KST 월~일 경계와 띄엄띄엄 한 날을 검증한다. 검토: docs/team/reviews/2026-11-17-server-week-stamps.md
begin;
select plan(10);

insert into auth.users (id, aud, role, is_anonymous) values
  ('74000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('74000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('74000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('74000000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values
  ('74f00000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-0000000000c1'),
  ('74f00000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('74b00000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000c1', '74f00000-0000-0000-0000-000000000001', 'child'),
  ('74b00000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-0000000000a1', '74f00000-0000-0000-0000-000000000001', 'parent'),
  ('74b00000-0000-0000-0000-0000000000a2', '74000000-0000-0000-0000-0000000000a2', '74f00000-0000-0000-0000-000000000002', 'parent');
-- 고정 주: 2026-11-16(월) ~ 11-22(일). 월·수 완료, 목 미완료, 지난 일요일(11-15) 완료, 다음 월요일(11-23) 완료. 다른 가족 어르신은 화요일 완료
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps, completed_at) values
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000a1', '2026-11-16', array['photo','question','hangul'], now()),
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000a1', '2026-11-18', array['photo','question','hangul'], now()),
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000a1', '2026-11-19', array['photo'], null),
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000a1', '2026-11-15', array['photo','question','hangul'], now()),
  ('74f00000-0000-0000-0000-000000000001', '74b00000-0000-0000-0000-0000000000a1', '2026-11-23', array['photo','question','hangul'], now()),
  ('74f00000-0000-0000-0000-000000000002', '74b00000-0000-0000-0000-0000000000a2', '2026-11-17', array['photo','question','hangul'], now());

-- 1~5. 기준일 고정(목요일 11-19)
select is((public.week_stamps_for('74b00000-0000-0000-0000-0000000000a1', '2026-11-19')) ->> 'week_start', '2026-11-16', '주 시작은 KST 월요일');
select is((public.week_stamps_for('74b00000-0000-0000-0000-0000000000a1', '2026-11-19')) -> 'done_dates', '["2026-11-16", "2026-11-18"]'::jsonb, '띄엄띄엄 한 날 포함, 미완료·지난주·다음 주·다른 가족 제외');
-- 6~7. 경계: 일요일(11-22)은 같은 주, 월요일(11-23)은 새 주
select is((public.week_stamps_for('74b00000-0000-0000-0000-0000000000a1', '2026-11-22')) ->> 'week_start', '2026-11-16', '일요일은 그 주에 속한다');
select is((public.week_stamps_for('74b00000-0000-0000-0000-0000000000a1', '2026-11-23')) -> 'done_dates', '["2026-11-23"]'::jsonb, '월요일이 되면 새 주로 바뀐다');
select is((public.week_stamps_for('74b00000-0000-0000-0000-0000000000a2', '2026-11-19')) -> 'done_dates', '["2026-11-17"]'::jsonb, '다른 가족 어르신 기록은 섞이지 않는다');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 6~10. 권한
select pg_temp.act_as('74000000-0000-0000-0000-0000000000a1', true);
select ok((public.my_week_stamps()) ? 'done_dates', '어르신은 자기 도장 줄을 받는다');
select throws_ok($$ select public.week_stamps_for('74b00000-0000-0000-0000-0000000000a2', '2026-11-19') $$, '42501', null, '내부 함수는 직접 호출할 수 없다(다른 어르신 조회 차단)');
select pg_temp.act_as('74000000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.my_week_stamps() $$, '%parent_required%', '자녀는 호출할 수 없다(참여 여부 비공개)');
select pg_temp.act_as('74000000-0000-0000-0000-0000000000a9', true);
select throws_like($$ select public.my_week_stamps() $$, '%parent_required%', '프로필 없는 기기는 호출할 수 없다');
reset role;
set local role anon;
select throws_ok($$ select public.my_week_stamps() $$, '42501', null, 'anon은 실행할 수 없다');

select * from finish();
rollback;
