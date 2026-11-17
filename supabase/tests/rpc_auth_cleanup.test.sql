-- 0017 계정 지우기 때 인증 계정·소셜 식별 정보 삭제, 소셜 로그인 직전 고아 익명 정리 (pgTAP). 실행: npx supabase test db
begin;
select plan(10);
delete from public.answers;

insert into auth.users (id, aud, role, is_anonymous) values
  ('81000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 카카오 자녀(다른 자녀 있음)
  ('81000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 같은 가족 자녀2(남아야 함)
  ('81000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 같은 가족 어르신
  ('8f000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 프로필 없는 익명(미리보기)
  ('8f000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', false); -- 프로필 없는 비익명(가입 직후 자녀)
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-777', '81000000-0000-0000-0000-0000000000c1', '{"sub":"kakao-777","name":"닉네임"}', 'kakao');
insert into public.families (id, created_by) values ('8f100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('8b100000-0000-0000-0000-0000000000c1', '81000000-0000-0000-0000-0000000000c1', '8f100000-0000-0000-0000-000000000001', 'child'),
  ('8b100000-0000-0000-0000-0000000000c2', '81000000-0000-0000-0000-0000000000c2', '8f100000-0000-0000-0000-000000000001', 'child'),
  ('8b100000-0000-0000-0000-0000000000a1', '81000000-0000-0000-0000-0000000000a1', '8f100000-0000-0000-0000-000000000001', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~3. 자녀 탈퇴: 앱 데이터와 함께 인증 계정·소셜 식별 정보(카카오 회원번호·닉네임)가 지워진다
select pg_temp.act_as('81000000-0000-0000-0000-0000000000c1', false);
select is((public.delete_my_account()) ->> 'scope', 'child', '자녀 본인 삭제');
reset role;
select is((select count(*)::int from auth.users where id = '81000000-0000-0000-0000-0000000000c1'), 0, '자녀의 인증 계정이 삭제된다');
select is((select count(*)::int from auth.identities where user_id = '81000000-0000-0000-0000-0000000000c1'), 0, '소셜 식별 정보(identities)도 함께 삭제된다');

-- 4. 같은 가족 다른 사람의 인증 계정은 그대로
select is((select count(*)::int from auth.users where id in ('81000000-0000-0000-0000-0000000000c2', '81000000-0000-0000-0000-0000000000a1')), 2, '같은 가족 다른 사람의 인증 계정은 남는다');

-- 5~6. 어르신 탈퇴도 본인 인증 계정까지
select pg_temp.act_as('81000000-0000-0000-0000-0000000000a1', true);
select is((public.delete_my_account()) ->> 'scope', 'parent', '어르신 본인 삭제');
reset role;
select is((select count(*)::int from auth.users where id = '81000000-0000-0000-0000-0000000000a1'), 0, '어르신(익명)의 인증 계정도 삭제된다');

-- 7~8. 고아 익명 정리: 프로필 없는 익명만 지운다
select pg_temp.act_as('8f000000-0000-0000-0000-0000000000a1', true);
select is((public.discard_anonymous_session()) ->> 'discarded', 'true', '프로필 없는 익명 사용자는 정리된다');
reset role;
select is((select count(*)::int from auth.users where id = '8f000000-0000-0000-0000-0000000000a1'), 0, '정리된 익명 사용자는 인증 계정이 없다');

-- 9. 비익명(자녀)은 정리하지 않는다
select pg_temp.act_as('8f000000-0000-0000-0000-0000000000b1', false);
select is((public.discard_anonymous_session()) ->> 'discarded', 'false', '익명이 아니면 정리하지 않는다');
reset role;

-- 10. 로그인 전(anon)은 실행할 수 없다
set local role anon;
select throws_ok($$ select public.discard_anonymous_session() $$, '42501', null, '로그인 전 사용자는 실행할 수 없다');

select * from finish();
rollback;
