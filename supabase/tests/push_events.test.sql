-- 0038 테스트 (pgTAP): 응원 도착(N2)·연결 알림(N3) 발송 대상, 일일 알림 문구 채우기. 실행: npx supabase test db
-- 보호하는 것: 응원은 받는 어르신에게만(1개면 응원 문장, 여러 개면 "n개"), 연결·재연결은 그 가족 자녀에게만(호칭 채움, U11: 자녀에게는 연결·응원 관련만),
--             알림 받기(push_consented_at)·켬·심사 아님·토큰 조건, KST 08:00~20:59 밖이면 선점하지 않고 기다림, 한 번 선점하면 다시 안 나감,
--             3일 지난 것은 보내지 않고 정리, 일일 알림 본문은 그날 사진 설명(없으면 대체 문장), 앱은 못 부름, 5분 cron은 할 일이 있을 때만 호출.
begin;
select plan(20);
select set_config('bumo.allow_content_delete', 'on', true);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70380000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70380000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 알림 받기 안 함
  ('70380000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70380000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values ('7038f000-0000-0000-0000-000000000001', '70380000-0000-0000-0000-0000000000c1', '부모님');
insert into public.profiles (id, user_id, family_id, role, consented_at, parent_title, push_consented_at) values
  ('7038b000-0000-0000-0000-0000000000c1', '70380000-0000-0000-0000-0000000000c1', '7038f000-0000-0000-0000-000000000001', 'child', null, null, now()),
  ('7038b000-0000-0000-0000-0000000000c2', '70380000-0000-0000-0000-0000000000c2', '7038f000-0000-0000-0000-000000000001', 'child', null, null, null),
  ('7038b000-0000-0000-0000-0000000000a1', '70380000-0000-0000-0000-0000000000a1', '7038f000-0000-0000-0000-000000000001', 'parent', now(), '엄마', now()),
  ('7038b000-0000-0000-0000-0000000000a2', '70380000-0000-0000-0000-0000000000a2', '7038f000-0000-0000-0000-000000000001', 'parent', now(), null, now());
insert into public.device_tokens (user_id, token) values
  ('70380000-0000-0000-0000-0000000000c1', 'p37_c1_0000000000000001'),
  ('70380000-0000-0000-0000-0000000000c2', 'p37_c2_0000000000000001'),
  ('70380000-0000-0000-0000-0000000000a1', 'p37_a1_0000000000000001'),
  ('70380000-0000-0000-0000-0000000000a2', 'p37_a2_0000000000000001');
delete from public.push_copy; delete from public.cheer_texts;
insert into public.push_copy (kind, title, body, body_fallback, body_many) values
  ('daily', '오늘의 사진이 왔어요', '{설명}', '편할 때 열어 보세요', null),
  ('cheer_arrived', '가족이 보낸 응원이 왔어요', '{응원}', null, '응원이 {n}개 왔어요'),
  ('parent_connected', '{호칭} 폰과 연결됐어요', '고르신 답을 보여 줄지는 {호칭}께서 정해요', null, null),
  ('parent_reconnected', '{호칭} 폰과 다시 연결됐어요', '새 폰으로 이어졌어요. 지난 답은 그대로 있어요', null, null);
insert into public.cheer_texts (message_key, text) values ('love_you', '사랑해요, 오늘도 좋은 하루예요'), ('warm_day', '덕분에 하루가 따뜻해요');
-- 응원: 어르신1에 1개, 어르신2에 2개, 4일 전 것 1개(정리 대상)
insert into public.cheers (family_id, from_child, to_parent, message_key, sent_at) values
  ('7038f000-0000-0000-0000-000000000001', '7038b000-0000-0000-0000-0000000000c1', '7038b000-0000-0000-0000-0000000000a1', 'love_you', now()),
  ('7038f000-0000-0000-0000-000000000001', '7038b000-0000-0000-0000-0000000000c1', '7038b000-0000-0000-0000-0000000000a2', 'love_you', now()),
  ('7038f000-0000-0000-0000-000000000001', '7038b000-0000-0000-0000-0000000000c1', '7038b000-0000-0000-0000-0000000000a2', 'warm_day', now()),
  ('7038f000-0000-0000-0000-000000000001', '7038b000-0000-0000-0000-0000000000c1', '7038b000-0000-0000-0000-0000000000a1', 'warm_day', now() - interval '4 days');
-- 연결 알림: 어르신1 연결, 어르신2 재연결
insert into public.notification_queue (family_id, kind, payload) values
  ('7038f000-0000-0000-0000-000000000001', 'parent_connected', jsonb_build_object('parent_id', '7038b000-0000-0000-0000-0000000000a1', 'reconnect', false)),
  ('7038f000-0000-0000-0000-000000000001', 'parent_connected', jsonb_build_object('parent_id', '7038b000-0000-0000-0000-0000000000a2', 'reconnect', true));

create function pg_temp.at_kst(p_hhmm text) returns timestamptz language sql as $$
  select (public.kst_today()::text || ' ' || p_hhmm)::timestamp at time zone 'Asia/Seoul'
$$;
create temp table claimed as select null::jsonb j limit 0;
create function pg_temp.mine(p jsonb, p_kind text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(t - 'token' - 'platform' order by t ->> 'profile_id', t ->> 'title'), '[]'::jsonb)
    from jsonb_array_elements(p -> 'targets') t where t ->> 'profile_id' like '7038b000%' and t ->> 'kind' = p_kind
$$;

-- 밤에는 선점하지 않는다
select is(pg_temp.mine(public.push_events_claim(pg_temp.at_kst('22:00')), 'cheer_arrived'), '[]'::jsonb, '창 밖에서는 대상 없음');
select is((select count(*)::int from public.cheers where to_parent::text like '7038b000%' and notified_at is null), 4, '창 밖에서는 응원을 처리하지 않고 기다린다');
select is(public.push_events_kick(pg_temp.at_kst('22:00')) ->> 'status', 'outside_window', '5분 cron도 창 밖이면 함수를 부르지 않는다');
select is(public.push_events_kick(pg_temp.at_kst('10:00')) ->> 'status', 'not_configured', '할 일이 있으면 부르려 하지만 설정이 없으면 not_configured');

insert into claimed select public.push_events_claim(pg_temp.at_kst('10:00'));
select is(pg_temp.mine((select j from claimed), 'cheer_arrived'),
  jsonb_build_array(
    jsonb_build_object('profile_id', '7038b000-0000-0000-0000-0000000000a1', 'kind', 'cheer_arrived', 'channel', 'cheer', 'title', '가족이 보낸 응원이 왔어요', 'body', '사랑해요, 오늘도 좋은 하루예요'),
    jsonb_build_object('profile_id', '7038b000-0000-0000-0000-0000000000a2', 'kind', 'cheer_arrived', 'channel', 'cheer', 'title', '가족이 보낸 응원이 왔어요', 'body', '응원이 2개 왔어요')),
  '응원은 받는 어르신에게만: 1개면 그 문장, 여러 개면 개수(3일 지난 것 제외)');
select is(pg_temp.mine((select j from claimed), 'parent_connected'),
  jsonb_build_array(jsonb_build_object('profile_id', '7038b000-0000-0000-0000-0000000000c1', 'kind', 'parent_connected', 'channel', 'family',
                                       'title', '엄마 폰과 연결됐어요', 'body', '고르신 답을 보여 줄지는 엄마께서 정해요')),
  '연결 알림은 알림을 받기로 한 자녀에게만, 어르신 호칭을 채운다');
select is(pg_temp.mine((select j from claimed), 'parent_reconnected'),
  jsonb_build_array(jsonb_build_object('profile_id', '7038b000-0000-0000-0000-0000000000c1', 'kind', 'parent_reconnected', 'channel', 'family',
                                       'title', '부모님 폰과 다시 연결됐어요', 'body', '새 폰으로 이어졌어요. 지난 답은 그대로 있어요')),
  '재연결은 다시 연결 문구, 어르신별 호칭이 없으면 가족 호칭');
select is((select count(*)::int from jsonb_array_elements((select j from claimed) -> 'targets') t
            where t ->> 'profile_id' like '7038b000%' and t ->> 'kind' = 'cheer_arrived' and t ->> 'profile_id' like '%c%'), 0,
          '자녀는 응원 도착 알림을 받지 않는다');
select is((select count(*)::int from jsonb_array_elements((select j from claimed) -> 'targets') t
            where t ->> 'profile_id' like '7038b000%' and t ->> 'kind' in ('parent_connected', 'parent_reconnected') and t ->> 'profile_id' like '%a%'), 0,
          '어르신은 연결 알림을 받지 않는다');
select is((select count(*)::int from public.cheers where to_parent::text like '7038b000%' and notified_at is null), 0, '처리한 응원(3일 지난 것 포함)은 다시 나가지 않게 표시된다');
select is((select count(*)::int from public.notification_queue where family_id = '7038f000-0000-0000-0000-000000000001' and sent_at is null), 0, '연결 알림 큐도 처리 표시');
select is(pg_temp.mine(public.push_events_claim(pg_temp.at_kst('10:05')), 'cheer_arrived'), '[]'::jsonb, '두 번째 실행은 같은 응원을 다시 보내지 않는다');

-- 3일 지난 연결 알림은 보내지 않는다
insert into public.notification_queue (family_id, kind, payload, created_at) values
  ('7038f000-0000-0000-0000-000000000001', 'parent_connected', jsonb_build_object('parent_id', '7038b000-0000-0000-0000-0000000000a1', 'reconnect', false), now() - interval '4 days');
select is(pg_temp.mine(public.push_events_claim(pg_temp.at_kst('11:00')), 'parent_connected'), '[]'::jsonb, '3일 지난 연결 알림은 보내지 않는다');
select is((select count(*)::int from public.notification_queue where family_id = '7038f000-0000-0000-0000-000000000001' and sent_at is null), 0, '대신 처리 표시만 한다');
select is(public.push_events_kick(pg_temp.at_kst('11:00')) ->> 'status', 'nothing_to_send', '할 일이 없으면 함수를 부르지 않는다');

-- 일일 알림 본문 = 그날 사진 설명
delete from public.answers; delete from public.content_photos; delete from public.content_questions;
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'u', '마을 입구 나무', 'k');
insert into public.content_questions (day_index, option_a, option_b) values (1, 'a', 'b');
select is((select t ->> 'body' from jsonb_array_elements(public.push_daily_claim(pg_temp.at_kst('09:00')) -> 'targets') t
            where t ->> 'profile_id' = '7038b000-0000-0000-0000-0000000000a1'), '마을 입구 나무', '일일 알림 본문은 그 어르신의 오늘 사진 설명');
update public.push_copy set body = '{없는값}' where kind = 'daily';
select is(public.push_render('{설명}', '{}'::jsonb, '편할 때 열어 보세요'), '편할 때 열어 보세요', '채울 값이 없으면 대체 문장');

-- 권한
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
select pg_temp.act_as('70380000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select public.push_events_claim() $$, '42501', null, '앱은 발송 대상 함수를 못 부른다');
select throws_ok($$ select count(*) from public.cheer_texts $$, '42501', null, '앱은 발송 문구 표를 직접 못 읽는다');
reset role;
select is((select schedule from cron.job where jobname = 'push-events'), '*/5 * * * *', '연결·응원 알림은 5분마다 확인');

select * from finish();
rollback;
