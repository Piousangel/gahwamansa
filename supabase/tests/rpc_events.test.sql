-- 0022 테스트 (pgTAP): events 테이블·log_event. 실행: npx supabase test db
-- 보호하는 것: 이벤트 이름은 정한 목록만, 속성은 정한 키·짧은 영문 토큰/숫자/참거짓만(한글·띄어쓰기·중첩 = 글자 내용 금지),
--             가족·역할은 서버가 채운다(남의 가족으로 못 씀), 앱은 직접 읽거나 넣지 못하고 읽기는 서비스 역할만.
begin;
select plan(19);

insert into auth.users (id, aud, role, is_anonymous) values
  ('76000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('76000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('76000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true); -- 프로필 없는 기기(설치 직후)
insert into public.families (id, created_by) values ('76f00000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('76b00000-0000-0000-0000-0000000000c1', '76000000-0000-0000-0000-0000000000c1', '76f00000-0000-0000-0000-000000000001', 'child'),
  ('76b00000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000a1', '76f00000-0000-0000-0000-000000000001', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('76000000-0000-0000-0000-0000000000c1', false);
select is(public.log_event('child_report_viewed', '{"is_first": true, "days_since_connect": 3}'), '{"ok": true}'::jsonb, '자녀가 목록 안 이벤트를 남긴다');
select is(public.log_event('photo_liked', '{}') ->> 'reason', 'invalid_name', '목록 밖 이벤트 이름은 거부된다');
select is(public.log_event(null, '{}') ->> 'reason', 'invalid_name', '이름이 없으면 거부된다');
select is(public.log_event('cheer_sent', '{"message_key": "사랑해요"}') ->> 'reason', 'invalid_props', '한글 값(글자 내용)은 거부된다');
select is(public.log_event('cheer_sent', '{"note": "hi"}') ->> 'reason', 'invalid_props', '목록 밖 속성 키는 거부된다');
select is(public.log_event('cheer_sent', '{"channel": "two words"}') ->> 'reason', 'invalid_props', '띄어쓰기가 있는 값(자유 텍스트)은 거부된다');
select is(public.log_event('cheer_sent', '{"channel": {"a": 1}}') ->> 'reason', 'invalid_props', '중첩 값은 거부된다');
select is(public.log_event('cheer_sent', '["x"]') ->> 'reason', 'invalid_props', '객체가 아닌 속성은 거부된다');
select is(public.log_event('cheer_sent', jsonb_build_object('channel', repeat('a', 33))) ->> 'reason', 'invalid_props', '33자 넘는 값은 거부된다');
select throws_ok($$ select count(*) from public.events $$, '42501', null, '자녀는 이벤트를 읽지 못한다');
select throws_ok($$ insert into public.events (name) values ('app_first_open') $$, '42501', null, '자녀는 이벤트를 직접 넣지 못한다');

select pg_temp.act_as('76000000-0000-0000-0000-0000000000a1', true);
select is(public.log_event('course_completed', '{"day_index": 2, "duration_sec": 300, "tts_used": false, "app_version": "1.0.0"}'), '{"ok": true}'::jsonb, '어르신이 이벤트를 남긴다');
select pg_temp.act_as('76000000-0000-0000-0000-0000000000e1', true);
select is(public.log_event('app_first_open', null), '{"ok": true}'::jsonb, '프로필 없는 기기도 설치 이벤트를 남긴다');

reset role;
select is((select family_id::text || ':' || actor_role from public.events where name = 'child_report_viewed'),
          '76f00000-0000-0000-0000-000000000001:child', '가족·역할은 서버가 호출한 사람 기준으로 채운다');
select is((select coalesce(family_id::text, 'null') || ':' || actor_role || ':' || props::text from public.events where name = 'app_first_open'),
          'null:none:{}', '프로필 없는 기기는 가족 없음·역할 none, 속성은 빈 객체');
select is((select count(*)::int from public.events where family_id = '76f00000-0000-0000-0000-000000000001'), 2, '거부된 호출은 저장되지 않는다');

set local role service_role;
select is((select count(*)::int from public.events where family_id = '76f00000-0000-0000-0000-000000000001'), 2, '서비스 역할은 이벤트를 읽는다');
reset role;
delete from public.families where id = '76f00000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.events where family_id = '76f00000-0000-0000-0000-000000000001'), 0, '가족이 지워지면 그 가족 이벤트도 지워진다');

set local role anon;
select throws_ok($$ select public.log_event('app_first_open', '{}') $$, '42501', null, 'anon은 log_event를 실행하지 못한다');

select * from finish();
rollback;
