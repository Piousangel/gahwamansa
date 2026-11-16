-- 5단계: redeem_invite_code, give_consent 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 코드로 어르신 연결, 사용·만료·무효 구분, 재연결 시 기록 유지·이전 기기 차단,
--             5회 실패 잠금과 전역 상한, 실패 기록이 남는 것, 동의 처리
begin;
select plan(20);
delete from public.content_photos; delete from public.content_questions; -- 시드와 무관하게 동작(이 트랜잭션 안에서만, 마지막에 rollback)

insert into auth.users (id, aud, role, is_anonymous) values
  ('c1000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족F 자녀
  ('c2000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족G 자녀
  ('10000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 새 어르신 기기 n1
  ('10000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),  -- n2
  ('10000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true),  -- n3 (폰 교체 후 새 기기)
  ('10000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', true),  -- n4 (전역 상한 테스트)
  ('10000000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true),  -- 공격자
  ('10000000-0000-0000-0000-0000000000a0', 'authenticated', 'authenticated', true);  -- 이전 폰(old)

insert into public.families (id, created_by) values
  ('f0000000-0000-0000-0000-00000000000f', 'c1000000-0000-0000-0000-0000000000c1'),
  ('f0000000-0000-0000-0000-00000000000e', 'c2000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('b1000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-00000000000f', 'child', null),
  ('b2000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-00000000000e', 'child', null),
  ('b1000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000a0', 'f0000000-0000-0000-0000-00000000000f', 'parent', now()); -- 폰 바꾼 어르신(이전 기기)
insert into public.content_questions (id, day_index, option_a, option_b) values ('d0000000-0000-0000-0000-000000000001', 1, '바다', '산');
insert into public.answers (family_id, parent_id, question_id, choice) values
  ('f0000000-0000-0000-0000-00000000000f', 'b1000000-0000-0000-0000-0000000000a0', 'd0000000-0000-0000-0000-000000000001', 'A');
insert into public.invite_codes (code, family_id, created_by, target_profile_id, expires_at, used_at) values
  ('111111', 'f0000000-0000-0000-0000-00000000000f', 'b1000000-0000-0000-0000-0000000000c1', null, now() + interval '7 days', null),
  ('222222', 'f0000000-0000-0000-0000-00000000000f', 'b1000000-0000-0000-0000-0000000000c1', null, now() - interval '1 day', null),
  ('333333', 'f0000000-0000-0000-0000-00000000000f', 'b1000000-0000-0000-0000-0000000000c1', null, now() + interval '7 days', now()),
  ('444444', 'f0000000-0000-0000-0000-00000000000f', 'b1000000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-0000000000a0', now() + interval '7 days', null),
  ('555555', 'f0000000-0000-0000-0000-00000000000e', 'b2000000-0000-0000-0000-0000000000c1', null, now() + interval '7 days', null),
  ('666666', 'f0000000-0000-0000-0000-00000000000f', 'b1000000-0000-0000-0000-0000000000c1', null, now() + interval '7 days', null);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~3. 새 어르신 기기 n1이 유효한 코드로 연결
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a1', true);
select is((public.redeem_invite_code('111111')) ->> 'ok', 'true', '유효한 코드로 연결된다');
select is((select count(*)::int from public.profiles where user_id = '10000000-0000-0000-0000-0000000000a1' and role = 'parent' and family_id = 'f0000000-0000-0000-0000-00000000000f'), 1, '어르신 프로필이 우리 가족에 만들어진다');
reset role;
select is((select used_by from public.invite_codes where code = '111111' and used_at is not null), '10000000-0000-0000-0000-0000000000a1'::uuid, '코드는 사용 처리되고 사용자가 기록된다');

-- 4~7. n2: 사용된 코드, 만료, 없는 코드, 잘못된 형식
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a2', true);
select is((public.redeem_invite_code('111111')) ->> 'reason', 'used', '이미 사용된 코드는 used');
select is((public.redeem_invite_code('222222')) ->> 'reason', 'expired', '만료된 코드는 expired');
select is((public.redeem_invite_code('999999')) ->> 'reason', 'invalid', '없는 코드는 invalid');
select is((public.redeem_invite_code('abc123')) ->> 'reason', 'invalid', '숫자 6자리가 아니면 invalid');

-- 8. 자녀(비익명) 기기는 코드를 사용할 수 없다
select pg_temp.act_as('c1000000-0000-0000-0000-0000000000c1', false);
select is((public.redeem_invite_code('666666')) ->> 'reason', 'not_parent_device', '자녀 기기는 not_parent_device');

-- 9. 이미 연결된 기기가 다른 가족 코드를 쓰면 already_linked
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a1', true);
select is((public.redeem_invite_code('555555')) ->> 'reason', 'already_linked', '이미 다른 가족에 연결된 기기는 already_linked');

-- 10~12. 재연결: 폰 교체 후 새 기기 n3가 재연결 코드로 같은 어르신 프로필을 이어받는다
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a3', true);
select is((public.redeem_invite_code('444444')) ->> 'ok', 'true', '재연결 코드로 연결된다');
reset role;
select is((select user_id from public.profiles where id = 'b1000000-0000-0000-0000-0000000000a0'), '10000000-0000-0000-0000-0000000000a3'::uuid, '같은 프로필(기록 유지)에 새 기기가 연결된다');
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a0', true);
select is((select count(*)::int from public.answers), 0, '이전 기기는 더 이상 가족 데이터를 읽을 수 없다');

-- 13~15. 공격자: 5번 실패 후 유효한 코드로도 잠금, 코드는 그대로, 실패 기록이 남는다
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a9', true);
do $$ begin for i in 1..5 loop perform public.redeem_invite_code('90000' || i); end loop; end $$;
select is((public.redeem_invite_code('666666')) ->> 'reason', 'rate_limited', '5회 실패하면 유효한 코드도 rate_limited');
reset role;
select is((select used_at from public.invite_codes where code = '666666'), null, '잠긴 동안 유효한 코드는 사용되지 않는다');
select is((select count(*)::int from public.redeem_attempts where uid = '10000000-0000-0000-0000-0000000000a9' and not ok), 5, '실패 5건이 기록된다');

-- 16~18. 동의: 어르신은 동의할 수 있고, 동의하면 답변을 저장할 수 있다. 자녀는 동의 처리 불가
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$ select public.give_consent() $$, '어르신은 동의할 수 있다');
select lives_ok($$ insert into public.answers (family_id, parent_id, question_id, choice)
  values (public.my_family_id(), public.my_profile_id(), 'd0000000-0000-0000-0000-000000000001', 'B') $$, '동의한 뒤에는 답변을 저장할 수 있다');
select pg_temp.act_as('c1000000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.give_consent() $$, '%parent_required%', '자녀는 동의 처리를 할 수 없다');

-- 19. 로그인 전(anon)은 redeem을 실행할 수 없다
reset role;
set local role anon;
select throws_ok($$ select public.redeem_invite_code('111111') $$, '42501', null, '로그인 전 사용자는 실행할 수 없다');

-- 20. 전역 실패가 10분에 300회를 넘으면 busy
reset role;
insert into public.redeem_attempts (uid, ok, at) select gen_random_uuid(), false, now() from generate_series(1, 300);
select pg_temp.act_as('10000000-0000-0000-0000-0000000000a4', true);
select is((public.redeem_invite_code('666666')) ->> 'reason', 'busy', '전역 실패가 300회를 넘으면 busy');

select * from finish();
rollback;
