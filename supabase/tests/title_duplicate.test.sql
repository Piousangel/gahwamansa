-- 0028 테스트 (pgTAP): 같은 가족 어르신 호칭 중복 방지. 실행: npx supabase test db
-- 보호하는 것: 자녀가 다른 어르신과 같은 호칭(어르신별 호칭, 없으면 가족 호칭)으로 정하면 duplicate_title,
--             자기 호칭을 다시 정하는 것은 허용, 연결(redeem)은 기본 호칭이 겹쳐도 막지 않는다(자녀가 바꿀 때까지 허용).
begin;
select plan(7);

insert into auth.users (id, aud, role, is_anonymous) values
  ('7e100000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('7e100000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('7e100000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('7e100000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7e1f0000-0000-0000-0000-000000000001', '7e100000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('7e1b0000-0000-0000-0000-0000000000c1', '7e100000-0000-0000-0000-0000000000c1', '7e1f0000-0000-0000-0000-000000000001', 'child'),
  ('7e1b0000-0000-0000-0000-0000000000a1', '7e100000-0000-0000-0000-0000000000a1', '7e1f0000-0000-0000-0000-000000000001', 'parent'),
  ('7e1b0000-0000-0000-0000-0000000000a2', '7e100000-0000-0000-0000-0000000000a2', '7e1f0000-0000-0000-0000-000000000001', 'parent');
insert into public.invite_codes (code, family_id, created_by) values ('780001', '7e1f0000-0000-0000-0000-000000000001', '7e1b0000-0000-0000-0000-0000000000c1')
  on conflict do nothing;

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('7e100000-0000-0000-0000-0000000000c1', false);
select is(public.set_parent_title_for('7e1b0000-0000-0000-0000-0000000000a1', '엄마') ->> 'ok', 'true', '첫 어르신을 엄마로 정한다');
select is(public.set_parent_title_for('7e1b0000-0000-0000-0000-0000000000a2', '엄마') ->> 'reason', 'duplicate_title', '다른 어르신과 같은 호칭은 duplicate_title');
select is(public.set_parent_title_for('7e1b0000-0000-0000-0000-0000000000a1', '부모님') ->> 'reason', 'duplicate_title', '다른 어르신의 기본 호칭(가족 호칭)과 겹쳐도 duplicate_title');
select is(public.set_parent_title_for('7e1b0000-0000-0000-0000-0000000000a1', '엄마') ->> 'ok', 'true', '자기 호칭을 다시 정하는 것은 된다');
select is(public.set_parent_title_for('7e1b0000-0000-0000-0000-0000000000a2', '아빠') ->> 'ok', 'true', '겹치지 않는 호칭은 된다');

-- 연결: 셋째 어르신은 기본 호칭(부모님)으로 들어온다. 겹침 검사로 연결을 막지 않는다
select public.set_parent_title('엄마'); -- 가족 기본 호칭을 첫 어르신과 같게 바꿔도
select pg_temp.act_as('7e100000-0000-0000-0000-0000000000a3', true);
select is(public.redeem_invite_code('780001') ->> 'ok', 'true', '기본 호칭이 다른 어르신과 겹쳐도 연결은 된다');
select pg_temp.act_as('7e100000-0000-0000-0000-0000000000c1', false);
select is((select count(*)::int from jsonb_array_elements(public.child_summary() -> 'parents') e where e ->> 'title' = '엄마'), 2,
          '자녀가 바꿀 때까지 겹친 기본 호칭은 그대로 보인다(앱이 바꾸기를 안내)');

select * from finish();
rollback;
