-- delete_scope_preview: 삭제하면 무엇이 지워지는지 미리 알려 준다(삭제는 하지 않는다)
begin;
select plan(6);
insert into auth.users (id, aud, role, is_anonymous) values
  ('a1000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀1
  ('a1000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 자녀2
  ('a1000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 어르신
  ('a2000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 혼자인 자녀(다른 가족)
  ('a9000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 프로필 없음
insert into public.families (id, created_by) values
  ('af100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-0000000000c1'),
  ('af200000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('ab100000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000c1', 'af100000-0000-0000-0000-000000000001', 'child'),
  ('ab100000-0000-0000-0000-0000000000c2', 'a1000000-0000-0000-0000-0000000000c2', 'af100000-0000-0000-0000-000000000001', 'child'),
  ('ab100000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'af100000-0000-0000-0000-000000000001', 'parent'),
  ('ab200000-0000-0000-0000-0000000000c1', 'a2000000-0000-0000-0000-0000000000c1', 'af200000-0000-0000-0000-000000000001', 'child');
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('a1000000-0000-0000-0000-0000000000c1', false);
select is((public.delete_scope_preview()) ->> 'scope', 'child', '다른 자녀가 있으면 child(본인만)');
select pg_temp.act_as('a1000000-0000-0000-0000-0000000000a1', true);
select is((public.delete_scope_preview()) ->> 'scope', 'parent', '어르신은 parent(본인 기록)');
select pg_temp.act_as('a2000000-0000-0000-0000-0000000000c1', false);
select is((public.delete_scope_preview()) ->> 'scope', 'family', '마지막 자녀는 family(가족 전체)');
select pg_temp.act_as('a9000000-0000-0000-0000-0000000000a1', true);
select is((public.delete_scope_preview()) ->> 'scope', 'none', '프로필이 없으면 none(0049 P20, 이전 no_profile)');
reset role;
-- 이 테스트가 만든 가족만 센다(로컬 DB에 통합 테스트 데이터가 남아 있어도 결과가 같게)
select is((select count(*)::int from public.profiles
           where family_id in ('af100000-0000-0000-0000-000000000001', 'af200000-0000-0000-0000-000000000001')), 4,
          '미리 조회는 아무것도 지우지 않는다');
set local role anon;
select throws_ok($$ select public.delete_scope_preview() $$, '42501', null, '로그인 전 사용자는 실행할 수 없다');
select * from finish();
rollback;
