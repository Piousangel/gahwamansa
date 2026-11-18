-- 0045 테스트 (pgTAP): 테스터 가족 표시(families.is_test) + 사진 주소 변경 감사 처리자(재검토 Q-L1). 실행: npx supabase test db
-- 보호하는 것: 기본 false, 앱은 바꿀 수 없다, 서비스 역할은 admin_set_test_family(대상, 값, 사유, 처리자)로만 바꾸고 감사 행이 남는다,
--             심사 가족(is_review)과 별개다, 테스터 가족도 알림·기능은 그대로(지표에서만 뺀다).
begin;
select plan(10);

insert into auth.users (id, aud, role, is_anonymous) values ('70450000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false);
insert into public.families (id, created_by) values ('7045f000-0000-0000-0000-000000000001', '70450000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('7045b000-0000-0000-0000-0000000000c1', '70450000-0000-0000-0000-0000000000c1', '7045f000-0000-0000-0000-000000000001', 'child');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select is((select is_test from public.families where id = '7045f000-0000-0000-0000-000000000001'), false, '기본은 테스터 아님');
select pg_temp.act_as('70450000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ update public.families set is_test = true where id = '7045f000-0000-0000-0000-000000000001' $$, '42501', null, '앱은 테스터 표시를 바꿀 수 없다');
select throws_ok($$ select public.admin_set_test_family('7045f000-0000-0000-0000-000000000001', true, 'x', 'y') $$, '42501', null, '앱은 표시 함수를 못 부른다');
reset role;

set local role service_role;
select throws_like($$ select public.admin_set_test_family('7045f000-0000-0000-0000-000000000001', true, '', 'ops') $$, '%reason_required%', '사유 필수');
select is(public.admin_set_test_family('7045f000-0000-0000-0000-000000000001', true, '비공개 테스트 테스터', 'ops'), '{"ok": true, "is_test": true}'::jsonb, '서비스 역할이 테스터로 표시');
select is(public.admin_set_test_family('7045f000-0000-0000-0000-0000000000ff', true, 'x', 'ops') ->> 'reason', 'not_found', '없는 가족은 not_found');
reset role;
select is((select is_review from public.families where id = '7045f000-0000-0000-0000-000000000001'), false, '심사 가족 표시와 별개');
select is((select detail from public.admin_audit where action = 'test_family_mark' order by id desc limit 1),
          '{"is_test": true}'::jsonb, '감사 행이 남는다');
select ok(has_function_privilege('service_role', 'public.admin_set_test_family(uuid,boolean,text,text)', 'execute')
      and not has_function_privilege('anon', 'public.admin_set_test_family(uuid,boolean,text,text)', 'execute'), '서비스 역할만 실행');

-- Q-L1: 사진 주소 변경 감사의 처리자는 실제 호출 역할
select set_config('bumo.allow_content_delete', 'on', true);
insert into public.content_photos (day_index, image_url, caption, keyword) values (970045, 'https://x/a.jpg', 'c', 'k');
set local role service_role;
update public.content_photos set image_url = 'https://x/b.jpg' where day_index = 970045;
reset role;
select is((select operator from public.admin_audit where action = 'content_image_url' order by id desc limit 1), 'service_role', '사진 주소 변경 감사에 실제 호출 역할(service_role)이 남는다');

select * from finish();
rollback;
