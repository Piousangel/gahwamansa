-- 0054 테스트 (pgTAP): 서버가 남기는 측정 이벤트 account_deleted. 실행: npx supabase test db
-- 보호하는 것: 삭제마다 정확히 1건(앱 본인 삭제·관리자 삭제·연결 전 계정 삭제 모두), 개인 식별자 없음(family_id·profile_id·device_key null,
--             props는 scope·role만, 지운 사람·가족 id 문자열 없음), 심사 가족 삭제는 기록하지 않음.
begin;
select plan(14);
delete from public.events where name = 'account_deleted';

insert into auth.users (id, aud, role, is_anonymous) values
  ('70540000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70540000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70540000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70540000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70540000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', false), -- 연결 전(본인 삭제)
  ('70540000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated', false), -- 연결 전(관리자 삭제)
  ('70540000-0000-0000-0000-0000000000b9', 'authenticated', 'authenticated', false); -- 심사 가족 자녀
insert into public.families (id, created_by, parent_title, is_review) values
  ('70540000-0000-0000-0000-0000000000f1', '70540000-0000-0000-0000-0000000000c1', '엄마', false),
  ('70540000-0000-0000-0000-0000000000f9', '70540000-0000-0000-0000-0000000000c1', '엄마', true);
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('70540000-0000-0000-0000-00000000c001', '70540000-0000-0000-0000-0000000000c1', '70540000-0000-0000-0000-0000000000f1', 'child', null),
  ('70540000-0000-0000-0000-00000000c002', '70540000-0000-0000-0000-0000000000c2', '70540000-0000-0000-0000-0000000000f1', 'child', null),
  ('70540000-0000-0000-0000-00000000a001', '70540000-0000-0000-0000-0000000000a1', '70540000-0000-0000-0000-0000000000f1', 'parent', now()),
  ('70540000-0000-0000-0000-00000000a002', '70540000-0000-0000-0000-0000000000a2', '70540000-0000-0000-0000-0000000000f1', 'parent', now()),
  ('70540000-0000-0000-0000-00000000e901', '70540000-0000-0000-0000-0000000000b9', '70540000-0000-0000-0000-0000000000f9', 'child', null);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
-- 서버가 남긴 account_deleted의 props 목록(시간순)
create function pg_temp.logged() returns jsonb language sql as $$
  select coalesce(jsonb_agg(props order by id), '[]'::jsonb) from public.events where name = 'account_deleted'
$$;

-- 앱 본인 삭제: 자녀(다른 자녀 남음) → child
select pg_temp.act_as('70540000-0000-0000-0000-0000000000c2', false);
select public.delete_my_account();
reset role;
select is(pg_temp.logged(), '[{"scope": "child", "role": "child"}]'::jsonb, '앱 본인 삭제(자녀) 1건: scope child·role child');

-- 관리자 삭제: 어르신 → parent
set local role service_role;
select public.admin_delete_account('70540000-0000-0000-0000-00000000a002', '메일 요청 #54', 'ops');
reset role;
select is(pg_temp.logged() -> 1, '{"scope": "parent", "role": "parent"}'::jsonb, '관리자 삭제(어르신) 1건: scope parent');

-- 앱 본인 삭제: 마지막 자녀 → family(가족 전체가 지워져도 1건)
select pg_temp.act_as('70540000-0000-0000-0000-0000000000c1', false);
select public.delete_my_account();
reset role;
select is(pg_temp.logged() -> 2, '{"scope": "family", "role": "child"}'::jsonb, '마지막 자녀 삭제는 가족 전체여도 1건: scope family');

-- 연결 전 계정: 앱 본인 삭제·관리자 삭제 → none
select pg_temp.act_as('70540000-0000-0000-0000-0000000000e1', false);
select public.delete_my_account();
reset role;
set local role service_role;
select public.admin_delete_user('70540000-0000-0000-0000-0000000000e2', '메일 요청 #55', 'ops');
reset role;
select is(jsonb_build_array(pg_temp.logged() -> 3, pg_temp.logged() -> 4), '[{"scope": "none", "role": "none"}, {"scope": "none", "role": "none"}]'::jsonb, '연결 전 계정 삭제(본인·관리자) 각 1건: scope none');
select is(jsonb_array_length(pg_temp.logged()), 5, '삭제 5번에 정확히 5건');

-- 심사 가족은 기록하지 않음
select pg_temp.act_as('70540000-0000-0000-0000-0000000000b9', false);
select public.delete_my_account();
reset role;
select is(jsonb_array_length(pg_temp.logged()), 5, '심사 가족 삭제는 기록하지 않는다');

-- 식별자 없음
select ok(not exists (select 1 from public.events where name = 'account_deleted'
                       and (family_id is not null or profile_id is not null or device_key is not null)), 'family_id·profile_id·device_key 모두 비어 있다');
select ok(not exists (select 1 from public.events where name = 'account_deleted'
                       and (select array_agg(k order by k) from jsonb_object_keys(props) k) <> array['role', 'scope']), 'props 키는 scope·role 두 개뿐');
select ok(pg_temp.logged()::text !~ '7054', '지운 사람·가족의 id 문자열이 기록에 없다');
select ok(not exists (select 1 from public.events where name = 'account_deleted' and ts <> date_trunc('hour', ts)), '기록 시각은 시 단위로 잘려 있다(리뷰 L2)');

-- 측정 기록 실패를 주입해도 삭제는 성공(리뷰 L1)
insert into auth.users (id, aud, role, is_anonymous) values
  ('70540000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', false),
  ('70540000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', false);
insert into public.families (id, created_by, parent_title) values ('70540000-0000-0000-0000-0000000000f2', '70540000-0000-0000-0000-0000000000d1', '엄마');
insert into public.profiles (id, user_id, family_id, role) values
  ('70540000-0000-0000-0000-00000000d001', '70540000-0000-0000-0000-0000000000d1', '70540000-0000-0000-0000-0000000000f2', 'child');
create function public.t0054_fail_account_deleted() returns trigger language plpgsql as $$
begin
  if new.name = 'account_deleted' then raise exception 'injected_failure'; end if;
  return new;
end $$;
create trigger t_fail_account_deleted before insert on public.events for each row execute function public.t0054_fail_account_deleted();
select pg_temp.act_as('70540000-0000-0000-0000-0000000000d1', false);
select lives_ok($$ select public.delete_my_account() $$, '측정 기록이 실패해도 앱 본인 삭제는 성공');
reset role;
set local role service_role;
select lives_ok($$ select public.admin_delete_user('70540000-0000-0000-0000-0000000000d2', '메일 요청 #56', 'ops') $$, '측정 기록이 실패해도 연결 전 계정 관리자 삭제는 성공');
reset role;
select is((select count(*)::int from auth.users where id in ('70540000-0000-0000-0000-0000000000d1', '70540000-0000-0000-0000-0000000000d2'))
        + (select count(*)::int from public.families where id = '70540000-0000-0000-0000-0000000000f2'), 0, '계정·가족은 실제로 지워졌다');
select is(jsonb_array_length(pg_temp.logged()), 5, '실패한 측정 행은 남지 않는다(0건 추가)');
drop trigger t_fail_account_deleted on public.events; -- 함수·트리거 모두 끝의 rollback으로 사라진다

select * from finish();
rollback;
