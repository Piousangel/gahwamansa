-- 0041 테스트 (pgTAP): child_summary.parents[].connected_date. 실행: npx supabase test db
-- 보호하는 것: 어르신이 처음 연결된 날(KST)이 어르신별로 온다(호칭 겹침 시트에서 구분), 다른 가족은 안 보인다.
begin;
select plan(3);
insert into auth.users (id, aud, role, is_anonymous) values
  ('70410000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', false),
  ('70410000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', false),
  ('70410000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true),
  ('70410000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values
  ('7041f000-0000-0000-0000-0000000000d1', '70410000-0000-0000-0000-0000000000d1'),
  ('7041f000-0000-0000-0000-0000000000d2', '70410000-0000-0000-0000-0000000000d2');
insert into public.profiles (id, user_id, family_id, role, created_at) values
  ('7041b000-0000-0000-0000-0000000000d1', '70410000-0000-0000-0000-0000000000d1', '7041f000-0000-0000-0000-0000000000d1', 'child', now() - interval '9 days'),
  ('7041b000-0000-0000-0000-0000000000d2', '70410000-0000-0000-0000-0000000000d2', '7041f000-0000-0000-0000-0000000000d2', 'child', now() - interval '9 days'),
  ('7041b000-0000-0000-0000-0000000000e1', '70410000-0000-0000-0000-0000000000e1', '7041f000-0000-0000-0000-0000000000d1', 'parent', '2026-11-12 14:00+00'), -- KST 11-12 23:00
  ('7041b000-0000-0000-0000-0000000000e2', '70410000-0000-0000-0000-0000000000e2', '7041f000-0000-0000-0000-0000000000d1', 'parent', '2026-11-12 15:30+00'); -- KST 11-13 00:30
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
select pg_temp.act_as('70410000-0000-0000-0000-0000000000d1', false);
select is(public.child_summary() -> 'parents' -> 0 ->> 'connected_date', '2026-11-12', '처음 연결된 날(KST)');
select is(public.child_summary() -> 'parents' -> 1 ->> 'connected_date', '2026-11-13', 'KST 자정을 넘으면 다음 날');
select pg_temp.act_as('70410000-0000-0000-0000-0000000000d2', false);
select is(public.child_summary() -> 'parents', '[]'::jsonb, '다른 가족 어르신은 안 보인다');
select * from finish();
rollback;
