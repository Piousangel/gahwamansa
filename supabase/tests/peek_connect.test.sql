-- 0028 테스트 (pgTAP): peek_invite_code, 연결 성공 알림 큐. 실행: npx supabase test db
-- 보호하는 것: 번호 확인(peek)은 호칭만 돌려주고 번호를 쓰지 않는다, 만료·사용됨·무효를 구분한다,
--             redeem과 같은 시도 한도(기기당 10분 5회 실패)·어르신 기기 전용이 적용된다,
--             연결에 성공하면 자녀 알림 큐(parent_connected)에 한 줄이 쌓이고 번호 값은 들어가지 않는다, 앱은 큐를 볼 수 없다.
begin;
select plan(17);

insert into auth.users (id, aud, role, is_anonymous) values
  ('7d100000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('7d100000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('7d100000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('7d100000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true); -- 실패 반복 기기
insert into public.families (id, created_by, parent_title) values ('7d1f0000-0000-0000-0000-000000000001', '7d100000-0000-0000-0000-0000000000c1', '엄마');
insert into public.profiles (id, user_id, family_id, role, parent_title) values
  ('7d1b0000-0000-0000-0000-0000000000c1', '7d100000-0000-0000-0000-0000000000c1', '7d1f0000-0000-0000-0000-000000000001', 'child', null),
  ('7d1b0000-0000-0000-0000-0000000000d1', null, '7d1f0000-0000-0000-0000-000000000001', 'parent', '할아버지'); -- 재연결 대상
insert into public.invite_codes (code, family_id, created_by, target_profile_id, expires_at, used_at) values
  ('710001', '7d1f0000-0000-0000-0000-000000000001', '7d1b0000-0000-0000-0000-0000000000c1', null, now() + interval '7 days', null),
  ('710002', '7d1f0000-0000-0000-0000-000000000001', '7d1b0000-0000-0000-0000-0000000000c1', null, now() - interval '1 hour', null),
  ('710003', '7d1f0000-0000-0000-0000-000000000001', '7d1b0000-0000-0000-0000-0000000000c1', null, now() + interval '7 days', now()),
  ('710004', '7d1f0000-0000-0000-0000-000000000001', '7d1b0000-0000-0000-0000-0000000000c1', '7d1b0000-0000-0000-0000-0000000000d1', now() + interval '1 day', null);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- ---- peek ----
select pg_temp.act_as('7d100000-0000-0000-0000-0000000000a1', true);
select is(public.peek_invite_code('710001'), '{"ok": true, "parent_title": "엄마"}'::jsonb, '살아 있는 번호는 호칭만 돌려준다');
select is(public.peek_invite_code('710004') ->> 'parent_title', '할아버지', '재연결 번호는 그 어르신의 호칭');
select is(public.peek_invite_code('710002') ->> 'reason', 'expired', '만료된 번호는 expired');
select is(public.peek_invite_code('710003') ->> 'reason', 'used', '쓴 번호는 used');
select is(public.peek_invite_code('999999') ->> 'reason', 'invalid', '없는 번호는 invalid');
select is(public.peek_invite_code('12ab') ->> 'reason', 'invalid', '형식이 틀리면 invalid');
reset role;
select is((select used_at from public.invite_codes where code = '710001'), null, 'peek은 번호를 쓰지 않는다');
select is((select count(*)::int from public.redeem_attempts where uid = '7d100000-0000-0000-0000-0000000000a1' and not ok), 4, '실패한 peek은 시도 기록에 남는다(redeem과 같은 한도)');

select pg_temp.act_as('7d100000-0000-0000-0000-0000000000a3', true);
select public.peek_invite_code('999999') from generate_series(1, 5);
select is(public.peek_invite_code('710001') ->> 'reason', 'rate_limited', '10분 5회 실패하면 peek도 잠긴다');
select is(public.redeem_invite_code('710001') ->> 'reason', 'rate_limited', 'peek 실패가 redeem 한도에도 들어간다');
select pg_temp.act_as('7d100000-0000-0000-0000-0000000000c1', false);
select is(public.peek_invite_code('710001') ->> 'reason', 'not_parent_device', '자녀 계정은 peek을 쓸 수 없다');

-- ---- 연결 성공 알림 큐 ----
select pg_temp.act_as('7d100000-0000-0000-0000-0000000000a1', true);
select is(public.redeem_invite_code('710001') ->> 'ok', 'true', '어르신이 연결된다');
select pg_temp.act_as('7d100000-0000-0000-0000-0000000000a2', true);
select is(public.redeem_invite_code('710004') ->> 'ok', 'true', '재연결도 된다');
reset role;
select is((select count(*)::int from public.notification_queue where family_id = '7d1f0000-0000-0000-0000-000000000001' and kind = 'parent_connected'), 2,
          '연결·재연결 성공마다 자녀 알림 큐에 한 줄씩 쌓인다');
select is((select count(*)::int from public.notification_queue where payload::text like '%7100%'), 0, '큐에 번호 값은 들어가지 않는다');
select is((select payload ->> 'reconnect' from public.notification_queue where payload ->> 'parent_id' = '7d1b0000-0000-0000-0000-0000000000d1'), 'true', '재연결 여부를 구분한다');
select pg_temp.act_as('7d100000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select count(*) from public.notification_queue $$, '42501', null, '앱은 알림 큐를 읽지 못한다');

select * from finish();
rollback;
