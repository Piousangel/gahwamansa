-- 0058 테스트 (pgTAP): 계정을 지우면 프로필 없이 쌓인 이용 기록(events.device_key = 그 uid의 sha256)도 함께 지운다(방침 4절).
-- 보호하는 것: 연결 전 계정 삭제(앱·관리자·0057 자동 정리), 연결된 계정 삭제(연결 전에 쌓인 기록 포함), 가족 전체 삭제 때 어르신 익명 계정 기록,
--             다른 사람의 이벤트는 남음, 탈퇴·정리 기록(account_deleted·account_purged, 식별자 없음)은 남음.
begin;
select plan(15);
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

-- 어르신 본인 삭제(리뷰 #178 L2)
insert into auth.users (id, aud, role, is_anonymous) values
  ('70580000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', false),
  ('70580000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70580000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', true), -- 소셜 로그인 직전 고아 익명(discard)
  ('70580000-0000-0000-0000-0000000000c4', 'authenticated', 'authenticated', false),
  ('70580000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true); -- 심사 가족 어르신
insert into public.families (id, created_by, parent_title, is_review) values
  ('70580000-0000-0000-0000-0000000000f2', '70580000-0000-0000-0000-0000000000c3', '엄마', false),
  ('70580000-0000-0000-0000-0000000000f3', '70580000-0000-0000-0000-0000000000c4', '엄마', true);
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('70580000-0000-0000-0000-00000000c003', '70580000-0000-0000-0000-0000000000c3', '70580000-0000-0000-0000-0000000000f2', 'child', null),
  ('70580000-0000-0000-0000-00000000a002', '70580000-0000-0000-0000-0000000000a2', '70580000-0000-0000-0000-0000000000f2', 'parent', now()),
  ('70580000-0000-0000-0000-00000000c004', '70580000-0000-0000-0000-0000000000c4', '70580000-0000-0000-0000-0000000000f3', 'child', null),
  ('70580000-0000-0000-0000-00000000a003', '70580000-0000-0000-0000-0000000000a3', '70580000-0000-0000-0000-0000000000f3', 'parent', now());
insert into public.events (family_id, profile_id, device_key, actor_role, name, props)
select null, null, public.event_device_key(u), 'none', 'app_first_open', '{}'::jsonb
  from unnest(array['70580000-0000-0000-0000-0000000000a2', '70580000-0000-0000-0000-0000000000d1', '70580000-0000-0000-0000-0000000000a3']::uuid[]) u;
select pg_temp.act_as('70580000-0000-0000-0000-0000000000a2', true);
select public.delete_my_account();
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000a2'), 0, '어르신 본인 삭제: 연결 전 이용 기록이 지워진다');

-- 소셜 로그인 직전 고아 익명 정리(discard, 리뷰 M1): 공통 함수를 거쳐 기록도 지우고, 탈퇴 기록은 남기지 않는다
select pg_temp.act_as('70580000-0000-0000-0000-0000000000d1', true);
select is(public.discard_anonymous_session(), '{"discarded": true}'::jsonb, 'discard는 그대로 동작한다');
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000d1') + (select count(*)::int from auth.users where id = '70580000-0000-0000-0000-0000000000d1'), 0,
          'discard: 인증 계정과 이용 기록이 함께 지워진다');

-- 심사 어르신 정리(admin_cleanup_review_family, 리뷰 L1)
set local role service_role;
select is(public.admin_cleanup_review_family('70580000-0000-0000-0000-0000000000f3') ->> 'parents_removed', '1', '심사 어르신 정리는 그대로 동작한다');
reset role;
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000a3') + (select count(*)::int from auth.users where id = '70580000-0000-0000-0000-0000000000a3'), 0,
          '심사 어르신 정리: 인증 계정과 이용 기록이 함께 지워진다');

-- 결정적 검사(리뷰 #178, 리드 결정): 인증 계정을 지우는 public 함수는 공통 함수 둘뿐 — 새 삭제 경로가 생기면 여기서 걸린다.
-- 적용 뒤 실제 함수 정의(pg_get_functiondef)를 본다(옛 정의가 남은 마이그레이션 파일을 grep하지 않음). 잡는 형태(재확인 L1):
--   delete/truncate + auth.users — 따옴표 식별자("auth"."users"·auth."users"), only, 공백·줄바꿈 포함
--   동적 SQL: 본문에 execute가 있고 auth·users 낱말이 함께 나오면(문자열 조립 format('... %I.%I', 'auth', 'users') 등) 의심 → 같은 허용 목록 밖이면 실패
create function pg_temp.auth_user_deleters() returns text[] language sql as $$
  select coalesce(array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text), '{}')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and (pg_get_functiondef(p.oid) ~* '(delete\s+from|truncate(\s+table)?)\s+(only\s+)?"?auth"?\s*\.\s*"?users"?'
          or (pg_get_functiondef(p.oid) ~* '\mexecute\M' and pg_get_functiondef(p.oid) ~* '\mauth\M' and pg_get_functiondef(p.oid) ~* '\musers\M'))
$$;
select is(pg_temp.auth_user_deleters(), array['account_delete_core(uuid)', 'user_delete_core(uuid,text)'],
          'auth.users를 지우는 public 함수는 account_delete_core·user_delete_core(uuid, text)뿐(동적 SQL·따옴표 식별자 포함)');
-- 검사가 실제로 잡는지: 일부러 위반 함수 셋을 만들어 본다(끝의 rollback으로 사라짐)
create function public.t0058_bad_quoted() returns void language plpgsql as $f$ begin delete from "auth"."users" where false; end $f$;
create function public.t0058_bad_dynamic() returns void language plpgsql as $f$ begin execute format('delete from %I.%I where false', 'auth', 'users'); end $f$;
create function public.t0058_bad_truncate() returns void language plpgsql as $f$ begin if false then truncate only auth . users; end if; end $f$;
select ok(pg_temp.auth_user_deleters() @> array['t0058_bad_dynamic()', 't0058_bad_quoted()', 't0058_bad_truncate()'],
          '따옴표 식별자·동적 SQL·truncate로 auth.users를 지우는 함수도 검사가 잡는다');
drop function public.t0058_bad_quoted(), public.t0058_bad_dynamic(), public.t0058_bad_truncate();

-- 남는 것
select is(pg_temp.left_for('70580000-0000-0000-0000-0000000000b9'), 1, '다른 사람의 이벤트는 남는다');
select is((select count(*)::int from public.events where name in ('account_deleted', 'account_purged') and device_key is null), 6,
          '탈퇴·정리 기록(식별자 없음)은 남는다(본인·관리자·정리 6번, discard·심사 정리는 기록 없음)');

select * from finish();
rollback;
