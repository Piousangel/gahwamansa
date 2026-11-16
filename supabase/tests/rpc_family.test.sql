-- 4단계: create_family, issue_invite_code 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 자녀만 가족을 만들고 코드를 발급, 코드 형식·만료·개수 제한·유일성, 다른 가족 어르신을 대상으로 지정 금지
begin;
select plan(14);

insert into auth.users (id, aud, role, is_anonymous) values
  ('d0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 새 자녀(프로필 없음)
  ('d0000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 익명(어르신 기기, 프로필 없음)
  ('e0000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 다른 가족 어르신
  ('e0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false); -- 다른 가족 자녀
insert into public.families (id, created_by) values ('fe000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('1e000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', 'fe000000-0000-0000-0000-000000000001', 'parent'),
  ('1e000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 'fe000000-0000-0000-0000-000000000001', 'child');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~3. 새 자녀가 가족을 만든다: 프로필(child)과 무료 기간 권한이 함께 생긴다
select pg_temp.act_as('d0000000-0000-0000-0000-0000000000c1', false);
select lives_ok($$ select public.create_family() $$, '자녀는 가족을 만들 수 있다');
select is((select count(*)::int from public.profiles where user_id = 'd0000000-0000-0000-0000-0000000000c1' and role = 'child'), 1, '자녀 프로필이 1개 생긴다');
select is((select count(*)::int from public.entitlements where plan_id = 'premium' and source = 'free_period'), 1, '무료 기간 권한이 생긴다');
-- 4. 같은 사용자가 다시 만들 수 없다
select throws_like($$ select public.create_family() $$, '%already_has_profile%', '이미 프로필이 있으면 다시 만들 수 없다');
-- 5. 익명(어르신 기기)은 가족을 만들 수 없다
select pg_temp.act_as('d0000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.create_family() $$, '%child_required%', '익명 사용자는 가족을 만들 수 없다');
-- 6. 어르신은 코드를 발급할 수 없다
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.issue_invite_code() $$, '%child_required%', '어르신은 코드를 발급할 수 없다');

-- 7~8. 자녀의 코드 발급: 숫자 6자리, 7일 만료, 미사용
select pg_temp.act_as('d0000000-0000-0000-0000-0000000000c1', false);
select matches((select public.issue_invite_code()), '^[0-9]{6}$', '코드는 숫자 6자리다');
select is((select count(*)::int from public.invite_codes where used_at is null and expires_at = now() + interval '7 days'), 1, '코드는 7일 뒤 만료되고 미사용 상태다');
-- 9. 다른 가족의 어르신을 대상으로 지정할 수 없다
select throws_like($$ select public.issue_invite_code('1e000000-0000-0000-0000-0000000000a1') $$, '%invalid_target%', '다른 가족 어르신을 재연결 대상으로 지정할 수 없다');
-- 10. 우리 가족 어르신은 대상으로 지정할 수 있다
reset role;
insert into public.profiles (id, user_id, family_id, role)
  select '1d000000-0000-0000-0000-0000000000a1', null, family_id, 'parent' from public.profiles where user_id = 'd0000000-0000-0000-0000-0000000000c1';
select pg_temp.act_as('d0000000-0000-0000-0000-0000000000c1', false);
select lives_ok($$ select public.issue_invite_code('1d000000-0000-0000-0000-0000000000a1') $$, '우리 가족 어르신은 재연결 대상으로 지정할 수 있다');
-- 11. 만료된 미사용 코드는 발급 시 정리된다
reset role;
insert into public.invite_codes (code, family_id, created_by, expires_at)
  select '999999', family_id, id, now() - interval '1 day' from public.profiles where user_id = 'd0000000-0000-0000-0000-0000000000c1';
select pg_temp.act_as('d0000000-0000-0000-0000-0000000000c1', false);
select public.issue_invite_code();
select is((select count(*)::int from public.invite_codes where code = '999999'), 0, '만료된 코드는 정리된다');
-- 12~13. 활성 코드는 가족당 5개까지, 모두 서로 다르다
do $$ begin for i in 1..2 loop perform public.issue_invite_code(); end loop; end $$;
select is((select count(distinct code)::int from public.invite_codes where used_at is null), 5, '활성 코드 5개는 모두 다르다');
select lives_ok($$ select public.issue_invite_code() $$, '활성 코드가 5개여도 새로 발급하면 가장 오래된 코드를 교체한다(too_many_codes 없음)');
-- 14. 로그인 전(anon)은 함수를 실행할 수 없다
reset role;
set local role anon;
select throws_ok($$ select public.create_family() $$, '42501', null, '로그인 전 사용자는 create_family를 실행할 수 없다');

select * from finish();
rollback;
