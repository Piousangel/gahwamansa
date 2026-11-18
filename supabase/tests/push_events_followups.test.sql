-- 0041 테스트 (pgTAP): 응원·연결 알림 리뷰 낮음(2026-11-18-push-events-review L1·L4·L5). 실행: npx supabase test db
-- 보호하는 것: L1 문구가 없는 종류는 할 일로 세지 않아 5분 cron이 함수를 부르지 않는다, 직전 실행이 dry-run이면 1시간 쉰다
--             L4 큐 처리 전에 어르신이 지워졌으면 연결 알림을 보내지 않는다
--             L5 다른 가족 자녀는 연결 알림을 받지 않는다, 문구가 없으면 소비하지 않는다, 심사 가족의 응원·연결은 제외된다.
begin;
select plan(9);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70410000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70410000-0000-0000-0000-0000000000c9', 'authenticated', 'authenticated', false), -- 다른 가족 자녀
  ('70410000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, is_review) values
  ('7041f000-0000-0000-0000-000000000001', '70410000-0000-0000-0000-0000000000c1', false),
  ('7041f000-0000-0000-0000-000000000009', '70410000-0000-0000-0000-0000000000c9', false);
insert into public.profiles (id, user_id, family_id, role, consented_at, push_consented_at) values
  ('7041b000-0000-0000-0000-0000000000c1', '70410000-0000-0000-0000-0000000000c1', '7041f000-0000-0000-0000-000000000001', 'child', null, now()),
  ('7041b000-0000-0000-0000-0000000000c9', '70410000-0000-0000-0000-0000000000c9', '7041f000-0000-0000-0000-000000000009', 'child', null, now()),
  ('7041b000-0000-0000-0000-0000000000a1', '70410000-0000-0000-0000-0000000000a1', '7041f000-0000-0000-0000-000000000001', 'parent', now(), now());
insert into public.device_tokens (user_id, token) values
  ('70410000-0000-0000-0000-0000000000c1', 'p41_c1_0000000000000001'),
  ('70410000-0000-0000-0000-0000000000c9', 'p41_c9_0000000000000001'),
  ('70410000-0000-0000-0000-0000000000a1', 'p41_a1_0000000000000001');
delete from public.push_copy; delete from public.cheer_texts; delete from public.push_runs;
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at) values
  ('7041f000-0000-0000-0000-000000000001', '7041b000-0000-0000-0000-0000000000c1', '7041b000-0000-0000-0000-0000000000a1', 'love_you', now());

create function pg_temp.at_kst(p_hhmm text) returns timestamptz language sql as $$
  select (public.kst_today()::text || ' ' || p_hhmm)::timestamp at time zone 'Asia/Seoul'
$$;
create function pg_temp.mine(p jsonb) returns text[] language sql as $$
  select coalesce(array_agg(t ->> 'profile_id' || ':' || (t ->> 'kind') order by t ->> 'profile_id'), '{}')
    from jsonb_array_elements(p -> 'targets') t where t ->> 'profile_id' like '7041b000%'
$$;

-- L1: 문구가 없으면 할 일로 세지 않는다
select is(public.push_events_kick(pg_temp.at_kst('10:00')) ->> 'status', 'nothing_to_send', '문구가 없으면 응원이 있어도 함수를 부르지 않는다');
-- L5: 문구가 없으면 소비하지 않는다
select is(pg_temp.mine(public.push_events_claim(pg_temp.at_kst('10:00'))), '{}'::text[], '문구가 없으면 대상 없음');
select is((select count(*)::int from public.cheers where to_parent = '7041b000-0000-0000-0000-0000000000a1' and notified_at is null), 1, '문구가 없으면 응원을 처리 표시하지 않는다(문구가 들어오면 보냄)');

insert into public.push_copy (kind, title, body, body_many) values
  ('cheer_arrived', '가족이 보낸 응원이 왔어요', '{응원}', '응원이 {n}개 왔어요'),
  ('parent_connected', '{호칭} 폰과 연결됐어요', '고른 답을 보여 줄지는 {호칭}께서 정해요', null),
  ('parent_reconnected', '{호칭} 폰과 다시 연결됐어요', '새 폰으로 이어졌어요', null);
-- L1: 직전 실행이 dry-run이면 1시간 쉰다
insert into public.push_runs (kind, run_at, note) values ('cheer_arrived', pg_temp.at_kst('09:30'), 'dry_run');
select is(public.push_events_kick(pg_temp.at_kst('10:00')) ->> 'status', 'throttled', '직전 실행이 dry-run이면 1시간 동안 부르지 않는다');
select is(public.push_events_kick(pg_temp.at_kst('10:31')) ->> 'status', 'not_configured', '1시간이 지나면 다시 부르려 한다(설정이 없어 not_configured)');

-- L4·L5: 연결 알림
insert into public.notification_queue (family_id, kind, payload) values
  ('7041f000-0000-0000-0000-000000000001', 'parent_connected', jsonb_build_object('parent_id', '7041b000-0000-0000-0000-0000000000a1', 'reconnect', false)),
  ('7041f000-0000-0000-0000-000000000001', 'parent_connected', jsonb_build_object('parent_id', '7041b000-0000-0000-0000-0000000000ee', 'reconnect', false)); -- 이미 지워진 어르신
select is(pg_temp.mine(public.push_events_claim(pg_temp.at_kst('10:40'))),
          array['7041b000-0000-0000-0000-0000000000a1:cheer_arrived', '7041b000-0000-0000-0000-0000000000c1:parent_connected'],
          '연결 알림은 그 가족 자녀에게 한 번만(지워진 어르신 큐는 보내지 않음), 다른 가족 자녀는 없음');
select is((select count(*)::int from public.notification_queue where family_id = '7041f000-0000-0000-0000-000000000001' and sent_at is null), 0, '지워진 어르신 큐도 처리 표시');

-- L5: 심사 가족 제외
update public.families set is_review = true where id = '7041f000-0000-0000-0000-000000000001';
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at) values
  ('7041f000-0000-0000-0000-000000000001', '7041b000-0000-0000-0000-0000000000c1', '7041b000-0000-0000-0000-0000000000a1', 'warm_day', now());
insert into public.notification_queue (family_id, kind, payload) values
  ('7041f000-0000-0000-0000-000000000001', 'parent_connected', jsonb_build_object('parent_id', '7041b000-0000-0000-0000-0000000000a1', 'reconnect', true));
select is(pg_temp.mine(public.push_events_claim(pg_temp.at_kst('11:00'))), '{}'::text[], '심사 가족의 응원·연결 알림은 보내지 않는다');
select is((select count(*)::int from public.cheers where to_parent = '7041b000-0000-0000-0000-0000000000a1' and notified_at is null), 0, '그래도 처리 표시는 한다(쌓이지 않게)');

select * from finish();
rollback;
