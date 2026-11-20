-- 0058 테스트 (pgTAP): 계정을 지우면 프로필 없이 쌓인 이용 기록(events.device_key = 그 uid의 sha256)도 함께 지운다(방침 4절).
-- 보호하는 것: 연결 전 계정 삭제(앱·관리자·0057 자동 정리), 연결된 계정 삭제(연결 전에 쌓인 기록 포함), 가족 전체 삭제 때 어르신 익명 계정 기록,
--             다른 사람의 이벤트는 남음, 탈퇴·정리 기록(account_deleted·account_purged, 식별자 없음)은 남음.
begin;
select plan(8);
delete from public.events where name in ('account_deleted', 'account_purged');

insert into auth.users (id, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('70580000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true, now(), now()),                                       -- 연결 전 본인 삭제
  ('70580000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated', true, now(), now()),                                       -- 연결 전 관리자 삭제
  ('70580000-0000-0000-0000-0000000000e3', 'authenticated', 'authenticated', true, now() - interval '100 days', now() - interval '100 days'), -- 자동 정리
  ('70580000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false, now(), now()),                                      -- 연결된 자녀(다른 자녀 있음)
  ('70580000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false, now(), now()),                                      -- 마지막 자녀(가족 전체)
  ('70580000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true, now(), now()),                                       -- 그 가족 어르신(익명)
  ('70580000-0000-0000-0000-0000000000b9', 'authenticated', 'authenticated', false, now(), now());                                      -- 다른 사람
insert into public.families (id, created_by, parent_title) values
  ('70580000-0000-0000-0000-0000000000f1', '70580000-0000-0000-0000-0000000000c1', '엄마');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('70580000-0000-0000-0000-00000000c001', '70580000-0000-0000-0000-0000000000c1', '70580000-0000-0000-0000-0000000000f1', 'child', null),
  ('70580000-0000-0000-0000-00000000c002', '70580000-0000-0000-0000-0000000000c2', '70580000-0000-0000-0000-0000000000f1', 'child', null),
  ('70580000-0000-0000-0000-00000000a001', '70580000-0000-0000-0000-0000000000a1', '70580000-0000-0000-0000-0000000000f1', 'parent', now());
-- 프로필 없이 쌓인 기록(연결 전): profile_id·family_id null, device_key = uid 해시
insert into public.events (family_id, profile_id, device_key, actor_role, name, props)
select null, null, public.event_device_key(u), 'none', 'app_first_open', '{}'::jsonb
  from unnest(array['70580000-0000-0000-0000-0000000000e1', '70580000-0000-0000-0000-0000000000e2', '70580000-0000-0000-0000-0000000000e3',
                    '70580000-0000-0000-0000-0000000000c1', '70580000-0000-0000-0000-0000000000c2', '70580000-0000-0000-0000-0000000000a1',
                    '70580000-0000-0000-0000-0000000000b9']::uuid[]) u;

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create function pg_temp.left_for(p_uid uuid) returns int language sql as $$
  select count(*)::int from public.events where device_key = public.event_device_key(p_uid)
$$;

-- 연결 전 계정: 앱 본인 삭제
select pg_temp.act_as('70580000-0000-0000-0000-0000000000e1', true);
select public.delete_my_account();
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000e1'), 0, '연결 전 본인 삭제: 그 사람의 이용 기록이 지워진다');
-- 연결 전 계정: 관리자 삭제
set local role service_role;
select public.admin_delete_user('70580000-0000-0000-0000-0000000000e2', '메일 요청 #58', 'ops');
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000e2'), 0, '연결 전 관리자 삭제: 이용 기록이 지워진다');
-- 0057 자동 정리도 같은 공통 함수
select public.purge_stale_anonymous(now());
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000e3'), 0, '90일 자동 정리: 이용 기록이 지워진다(같은 공통 함수)');

-- 연결된 계정: 자녀(다른 자녀 남음) — 연결 전에 쌓은 기록까지
select pg_temp.act_as('70580000-0000-0000-0000-0000000000c1', false);
select public.delete_my_account();
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000c1'), 0, '연결된 계정 삭제: 연결 전에 쌓은 기록도 지워진다');
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000a1'), 1, '가족이 남으면 어르신 기록은 그대로');

-- 연결된 계정: 마지막 자녀(관리자) → 가족 전체 + 어르신 익명 계정
set local role service_role;
select public.admin_delete_account('70580000-0000-0000-0000-00000000c002', '메일 요청 #59', 'ops');
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000c2') + pg_temp.left_for('70580000-0000-0000-0000-0000000000a1'), 0,
          '가족 전체 삭제: 자녀와 함께 지워지는 어르신 익명 계정의 기록도 지워진다');

-- 남는 것
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000b9'), 1, '다른 사람의 이벤트는 남는다');
select is((select count(*)::int from public.events where name in ('account_deleted', 'account_purged') and device_key is null), 5,
          '탈퇴·정리 기록(식별자 없음)은 남는다(삭제 5번)');

select * from finish();
rollback;
