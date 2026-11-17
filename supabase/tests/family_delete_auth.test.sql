-- 0028 테스트 (pgTAP): 마지막 자녀가 지워 가족 전체가 지워질 때 어르신 익명 인증 계정도 지운다. 실행: npx supabase test db
-- 보호하는 것(DECISIONS 2026-11-17 공백 처리): 가족 삭제 뒤 어르신 기기의 익명 계정이 고아로 남지 않는다.
--             자녀가 남아 있으면(가족 유지) 어르신 계정은 그대로, 다른 가족·익명이 아닌 계정은 건드리지 않는다.
begin;
select plan(6);

insert into auth.users (id, aud, role, is_anonymous) values
  ('7a100000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족F 유일 자녀
  ('7a100000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 가족F 어르신(익명)
  ('7a100000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', false), -- 가족F 어르신 프로필이지만 익명 아님(비정상 데이터)
  ('7a100000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', false), -- 가족H 자녀1
  ('7a100000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', false), -- 가족H 자녀2
  ('7a100000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', true);  -- 가족H 어르신(익명)
insert into public.families (id, created_by) values
  ('7a1f0000-0000-0000-0000-000000000001', '7a100000-0000-0000-0000-0000000000c1'),
  ('7a1f0000-0000-0000-0000-000000000002', '7a100000-0000-0000-0000-0000000000d1');
insert into public.profiles (id, user_id, family_id, role) values
  ('7a1b0000-0000-0000-0000-0000000000c1', '7a100000-0000-0000-0000-0000000000c1', '7a1f0000-0000-0000-0000-000000000001', 'child'),
  ('7a1b0000-0000-0000-0000-0000000000a1', '7a100000-0000-0000-0000-0000000000a1', '7a1f0000-0000-0000-0000-000000000001', 'parent'),
  ('7a1b0000-0000-0000-0000-0000000000a9', '7a100000-0000-0000-0000-0000000000a9', '7a1f0000-0000-0000-0000-000000000001', 'parent'),
  ('7a1b0000-0000-0000-0000-0000000000a0', null, '7a1f0000-0000-0000-0000-000000000001', 'parent'), -- 연결 끊긴 어르신
  ('7a1b0000-0000-0000-0000-0000000000d1', '7a100000-0000-0000-0000-0000000000d1', '7a1f0000-0000-0000-0000-000000000002', 'child'),
  ('7a1b0000-0000-0000-0000-0000000000d2', '7a100000-0000-0000-0000-0000000000d2', '7a1f0000-0000-0000-0000-000000000002', 'child'),
  ('7a1b0000-0000-0000-0000-0000000000b1', '7a100000-0000-0000-0000-0000000000b1', '7a1f0000-0000-0000-0000-000000000002', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 자녀가 남는 가족: 어르신 계정 유지
select pg_temp.act_as('7a100000-0000-0000-0000-0000000000d1', false);
select is((public.delete_my_account()) ->> 'scope', 'child', '자녀가 더 있으면 본인만 지운다');
reset role;
select is((select count(*)::int from auth.users where id = '7a100000-0000-0000-0000-0000000000b1'), 1, '가족이 남으면 어르신 인증 계정은 그대로다');

-- 마지막 자녀: 가족 전체 + 어르신 익명 계정
select pg_temp.act_as('7a100000-0000-0000-0000-0000000000c1', false);
select is((public.delete_my_account()) ->> 'scope', 'family', '마지막 자녀가 지우면 가족 전체가 지워진다');
reset role;
select is((select count(*)::int from auth.users where id = '7a100000-0000-0000-0000-0000000000a1'), 0, '어르신 익명 인증 계정도 지워진다');
select is((select count(*)::int from auth.users where id = '7a100000-0000-0000-0000-0000000000a9'), 1, '익명이 아닌 계정은 지우지 않는다');
select is((select count(*)::int from auth.users where id in ('7a100000-0000-0000-0000-0000000000b1', '7a100000-0000-0000-0000-0000000000d2')), 2, '다른 가족 계정은 그대로다');

select * from finish();
rollback;
