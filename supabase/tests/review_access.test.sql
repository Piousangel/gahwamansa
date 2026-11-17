-- 0025 테스트 (pgTAP): 스토어 심사용 가족(만료 없는 재사용 가입 번호). 실행: npx supabase test db
-- 보호하는 것: 심사 가족과 재사용 번호는 서비스 역할(운영 스크립트)만 만든다, 재사용 번호는 심사 가족에만 있을 수 있다,
--             여러 심사 기기가 같은 번호로 각자 어르신으로 연결된다, 새 번호 발급·연결(0018 무효화)과 파기 배치(0023)가
--             재사용 번호를 없애지 않는다, 심사 가족은 자녀 2명이라 한 명이 지워도 가족이 남는다.
begin;
select plan(16);

insert into auth.users (id, aud, role, is_anonymous) values
  ('79000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 심사 자녀1
  ('79000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 심사 자녀2
  ('79000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', false), -- 일반 자녀
  ('79000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 심사 기기1
  ('79000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);  -- 심사 기기2
insert into public.families (id, created_by) values ('79f00000-0000-0000-0000-000000000003', '79000000-0000-0000-0000-0000000000c3');
insert into public.profiles (id, user_id, family_id, role) values
  ('79b00000-0000-0000-0000-0000000000c3', '79000000-0000-0000-0000-0000000000c3', '79f00000-0000-0000-0000-000000000003', 'child');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 앱은 만들 수 없다
select pg_temp.act_as('79000000-0000-0000-0000-0000000000c3', false);
select throws_ok($$ select public.admin_create_review_family(array['79000000-0000-0000-0000-0000000000c1', '79000000-0000-0000-0000-0000000000c2']::uuid[]) $$,
  '42501', null, '로그인 사용자는 심사 가족을 만들지 못한다');
reset role;

-- 운영 스크립트(서비스 역할)
set local role service_role;
create temp table rv as select public.admin_create_review_family(array['79000000-0000-0000-0000-0000000000c1', '79000000-0000-0000-0000-0000000000c2']::uuid[]) r;
reset role;
grant select on rv to public;
select ok((select r ->> 'code' ~ '^[0-9]{6}$' from rv), '6자리 재사용 번호를 돌려준다(값은 출력만)');
select is((select is_review from public.families where id = (select (r ->> 'family_id')::uuid from rv)), true, '심사 가족 표시가 붙는다');
select is((select count(*)::int from public.profiles where family_id = (select (r ->> 'family_id')::uuid from rv) and role = 'child'), 2, '자녀 2명으로 구성된다');
select throws_like($$ select public.admin_create_review_family(array['79000000-0000-0000-0000-0000000000c3']::uuid[]) $$, '%already_has_profile%', '이미 가족이 있는 계정은 쓸 수 없다');
select throws_like($$ insert into public.invite_codes (code, family_id, created_by, reusable, expires_at)
  values ('790009', '79f00000-0000-0000-0000-000000000003', '79b00000-0000-0000-0000-0000000000c3', true, 'infinity') $$,
  '%reusable_code_review_only%', '재사용 번호는 심사 가족에만 만들 수 있다');

-- 심사 기기 2대가 같은 번호로 각자 연결
select pg_temp.act_as('79000000-0000-0000-0000-0000000000a1', true);
select is((public.redeem_invite_code((select r ->> 'code' from rv))) ->> 'ok', 'true', '심사 기기1이 연결된다');
select pg_temp.act_as('79000000-0000-0000-0000-0000000000a2', true);
select is((public.redeem_invite_code((select r ->> 'code' from rv))) ->> 'ok', 'true', '심사 기기2도 같은 번호로 연결된다');
reset role;
select is((select count(*)::int from public.profiles where family_id = (select (r ->> 'family_id')::uuid from rv) and role = 'parent'), 2, '어르신 프로필이 기기마다 따로 생긴다');
select is((select used_at from public.invite_codes where code = (select r ->> 'code' from rv)), null, '재사용 번호는 사용 처리되지 않는다');

-- 심사 자녀가 새 번호를 받아도 재사용 번호는 살아 있다(0018 예외)
select pg_temp.act_as('79000000-0000-0000-0000-0000000000c1', false);
select ok(public.issue_invite_code() ~ '^[0-9]{6}$', '심사 자녀도 일반 번호를 받을 수 있다');
reset role;
select ok((select expires_at > now() from public.invite_codes where code = (select r ->> 'code' from rv)), '새 번호 발급 뒤에도 재사용 번호는 만료되지 않는다');
select is((select reusable from public.invite_codes where code <> (select r ->> 'code' from rv)
            and family_id = (select (r ->> 'family_id')::uuid from rv) limit 1), false, '일반 발급 번호는 재사용이 아니다');

-- 파기 배치도 지우지 않는다
select public.purge_expired_data(now() + interval '400 days');
select is((select count(*)::int from public.invite_codes where code = (select r ->> 'code' from rv)), 1, '파기 배치가 재사용 번호를 지우지 않는다');

-- 자녀 1명이 지워도 가족은 남는다
select pg_temp.act_as('79000000-0000-0000-0000-0000000000c1', false);
select is((public.delete_my_account()) ->> 'scope', 'child', '심사 자녀 한 명이 지우면 본인만 지워진다');
reset role;
select is((select count(*)::int from public.families where id = (select (r ->> 'family_id')::uuid from rv)), 1, '심사 가족은 남는다');

select * from finish();
rollback;
