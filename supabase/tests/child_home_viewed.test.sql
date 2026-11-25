-- 0066 테스트 (pgTAP): child_home_viewed — 자녀 홈 열람, KST 하루 1회, 속성 없음. 실행: npx supabase test db
-- 보호하는 것: 기록(역할 child·props '{}'), 같은 KST 날짜 두 번째부터 저장 없이 {ok:true}, KST 자정 경계(UTC 날짜 아님),
--             어제(KST) 행은 오늘을 막지 않음, 계정마다 따로, 속성을 실으면 거부, 자녀 역할만(어르신·연결 전 계정은 저장 없음),
--             기존 이벤트 그대로, anon 거부. 동시 2회 → 1행(잠금)은 pgTAP 한 연결로는 못 보므로 supabase/ops/event-day-race.sh.
begin;
select plan(15);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70660000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('70660000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 같은 가족 다른 자녀
  ('70660000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 같은 가족 어르신
  ('70660000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true);  -- 연결 전(프로필 없음)
insert into public.families (id, created_by) values
  ('70660000-0000-0000-0000-0000000000f1', '70660000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('70660000-0000-0000-0000-0000000000b1', '70660000-0000-0000-0000-0000000000c1', '70660000-0000-0000-0000-0000000000f1', 'child'),
  ('70660000-0000-0000-0000-0000000000b2', '70660000-0000-0000-0000-0000000000c2', '70660000-0000-0000-0000-0000000000f1', 'child'),
  ('70660000-0000-0000-0000-0000000000a9', '70660000-0000-0000-0000-0000000000a1', '70660000-0000-0000-0000-0000000000f1', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
-- 서비스 역할로 센다(events 는 클라이언트가 못 읽음)
create function pg_temp.n(p_profile text) returns bigint language sql security definer as $$
  select count(*) from public.events where name = 'child_home_viewed' and profile_id = p_profile::uuid $$;
grant execute on function pg_temp.n(text) to public;
-- 이 계정의 기존 행을 시각 t 로 옮긴다(어제·자정 경계 흉내)
create function pg_temp.move_to(p_profile text, t timestamptz) returns void language sql security definer as $$
  update public.events set ts = t where name = 'child_home_viewed' and profile_id = p_profile::uuid $$;
grant execute on function pg_temp.move_to(text, timestamptz) to public;

select pg_temp.act_as('70660000-0000-0000-0000-0000000000c1', false);
select is(public.log_event('child_home_viewed', '{}'), '{"ok": true}'::jsonb, '첫 열람 기록');
select is(public.log_event('child_home_viewed'), '{"ok": true}'::jsonb, '같은 날 두 번째도 ok(앱이 다시 보내지 않게)');
select is(pg_temp.n('70660000-0000-0000-0000-0000000000b1'), 1::bigint, '같은 KST 날짜에는 한 행');
reset role;
select is((select actor_role || '|' || props::text || '|' || (family_id is not null)::text from public.events
            where name = 'child_home_viewed' and profile_id = '70660000-0000-0000-0000-0000000000b1'),
          'child|{}|true', '역할 child·속성 없음·가족 채움(서버가 채운다)');

-- KST 자정 경계: 오늘 KST 00:30 = UTC 로는 어제 15:30. UTC 날짜로 셌다면 새 행이 생긴다
select pg_temp.move_to('70660000-0000-0000-0000-0000000000b1', (public.kst_today()::timestamp at time zone 'Asia/Seoul') + interval '30 minutes');
select pg_temp.act_as('70660000-0000-0000-0000-0000000000c1', false);
select public.log_event('child_home_viewed', '{}');
select is(pg_temp.n('70660000-0000-0000-0000-0000000000b1'), 1::bigint, '오늘 KST 00:30 행이 있으면 저장하지 않는다(KST 날짜 기준)');

-- 어제 KST 23:59 행은 오늘을 막지 않는다
reset role;
select pg_temp.move_to('70660000-0000-0000-0000-0000000000b1', (public.kst_today()::timestamp at time zone 'Asia/Seoul') - interval '1 minute');
select pg_temp.act_as('70660000-0000-0000-0000-0000000000c1', false);
select is(public.log_event('child_home_viewed', '{}'), '{"ok": true}'::jsonb, '다음 KST 날 첫 열람');
select is(pg_temp.n('70660000-0000-0000-0000-0000000000b1'), 2::bigint, '어제 행 + 오늘 행');

-- 계정마다 따로(같은 가족 다른 자녀)
select pg_temp.act_as('70660000-0000-0000-0000-0000000000c2', false);
select public.log_event('child_home_viewed', '{}');
select is(pg_temp.n('70660000-0000-0000-0000-0000000000b2'), 1::bigint, '다른 자녀 계정은 따로 한 행');

-- 자녀 역할만: 어르신·연결 전 계정은 invalid_name, 행 없음
select pg_temp.act_as('70660000-0000-0000-0000-0000000000a1', true);
select is(public.log_event('child_home_viewed', '{}') ->> 'reason', 'invalid_name', '어르신 계정은 거부');
select pg_temp.act_as('70660000-0000-0000-0000-0000000000e1', true);
select is(public.log_event('child_home_viewed', '{}') ->> 'reason', 'invalid_name', '연결 전(역할 none) 계정은 거부');
reset role;
select is((select count(*) from public.events where name = 'child_home_viewed' and actor_role <> 'child'), 0::bigint, '자녀가 아닌 행은 0');
select pg_temp.act_as('70660000-0000-0000-0000-0000000000c2', false);

-- 속성 없음: 허용 키라도 실으면 거부
select is(public.log_event('child_home_viewed', '{"is_first": true}') ->> 'reason', 'invalid_props', '속성을 실으면 거부');
select is(public.log_event('child_home_viewd', '{}') ->> 'reason', 'invalid_name', '목록 밖 이름 거부');
select is(public.log_event('course_step_started', '{"step": "photo", "day_index": 2}'), '{"ok": true}'::jsonb, '0053 규칙 유지');

reset role;
set local role anon;
select throws_ok($$ select public.log_event('child_home_viewed', '{}') $$, '42501', null, 'anon은 기록하지 못한다');

select * from finish();
rollback;
