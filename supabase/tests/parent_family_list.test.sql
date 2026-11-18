-- 0030 테스트 (pgTAP): parent_family_list (P16 연결된 가족). 실행: npx supabase test db
-- 보호하는 것: 어르신 본인만 부른다, 같은 가족 자녀 계정마다 {seq, connected_at, connected_date}만(이름·이메일·id 없음),
--             연결일 = 어르신과 그 자녀가 둘 다 가족에 있게 된 시각, 다른 가족 자녀는 없다, 연결 전 기기는 빈 목록, 심사 가족도 정상 목록.
begin;
select plan(12);

insert into auth.users (id, aud, role, is_anonymous, email) values
  ('70300000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false, 'child1@example.com'),
  ('70300000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false, 'child2@example.com'),
  ('70300000-0000-0000-0000-0000000000c9', 'authenticated', 'authenticated', false, 'other@example.com'),
  ('70300000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true, null),
  ('70300000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true, null),  -- 다른 가족 어르신
  ('70300000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true, null);  -- 연결 전 기기
insert into public.families (id, created_by, is_review) values
  ('7030f000-0000-0000-0000-000000000001', '70300000-0000-0000-0000-0000000000c1', false),
  ('7030f000-0000-0000-0000-000000000009', '70300000-0000-0000-0000-0000000000c9', true); -- 심사 가족
insert into public.profiles (id, user_id, family_id, role, parent_title, created_at) values
  ('7030b000-0000-0000-0000-0000000000c1', '70300000-0000-0000-0000-0000000000c1', '7030f000-0000-0000-0000-000000000001', 'child', null, now() - interval '10 days'),
  ('7030b000-0000-0000-0000-0000000000a1', '70300000-0000-0000-0000-0000000000a1', '7030f000-0000-0000-0000-000000000001', 'parent', '엄마', now() - interval '5 days'),
  ('7030b000-0000-0000-0000-0000000000c2', '70300000-0000-0000-0000-0000000000c2', '7030f000-0000-0000-0000-000000000001', 'child', null, now() - interval '2 days'),
  ('7030b000-0000-0000-0000-0000000000c9', '70300000-0000-0000-0000-0000000000c9', '7030f000-0000-0000-0000-000000000009', 'child', null, now() - interval '3 days'),
  ('7030b000-0000-0000-0000-0000000000a9', '70300000-0000-0000-0000-0000000000a9', '7030f000-0000-0000-0000-000000000009', 'parent', null, now() - interval '1 days');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70300000-0000-0000-0000-0000000000a1', true);
select is(jsonb_array_length(public.parent_family_list() -> 'family'), 2, '같은 가족 자녀 2명이 나온다(다른 가족 자녀 없음)');
select is(public.parent_family_list() ->> 'title', '엄마', '가족이 나를 부르는 호칭이 함께 온다');
select is(public.parent_family_list() -> 'family' -> 0 ->> 'seq', '1', '연결 순서대로 순번');
select is((public.parent_family_list() -> 'family' -> 0 ->> 'connected_at')::timestamptz, now() - interval '5 days',
          '먼저 있던 자녀는 어르신이 연결된 시각');
select is((public.parent_family_list() -> 'family' -> 1 ->> 'connected_at')::timestamptz, now() - interval '2 days',
          '나중에 들어온 자녀는 그 자녀가 들어온 시각');
select is(((public.parent_family_list() -> 'family' -> 1 ->> 'connected_date'))::date, ((now() - interval '2 days') at time zone 'Asia/Seoul')::date,
          '화면용 KST 날짜');
select is(array(select k from jsonb_object_keys(public.parent_family_list() -> 'family' -> 0) k order by 1),
          array['connected_at', 'connected_date', 'seq'], '항목은 순번·연결 시각·날짜만');
select ok( position('example.com' in public.parent_family_list()::text) = 0
          and position('7030b000' in public.parent_family_list()::text) = 0, '자녀 이름·이메일·id가 없다');

select pg_temp.act_as('70300000-0000-0000-0000-0000000000a9', true);
select is(jsonb_array_length(public.parent_family_list() -> 'family'), 1, '심사 가족도 정상 목록(심사자가 P16을 볼 수 있게)');
select pg_temp.act_as('70300000-0000-0000-0000-0000000000e1', true);
select is(public.parent_family_list(), '{"title": null, "family": []}'::jsonb, '연결 전 기기는 빈 목록');
select pg_temp.act_as('70300000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.parent_family_list() $$, '%parent_required%', '자녀는 부를 수 없다');
reset role;
set local role anon;
select throws_ok($$ select public.parent_family_list() $$, '42501', null, 'anon은 실행하지 못한다');

select * from finish();
rollback;
