-- RLS 격리 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 다른 가족 데이터 비공개, 쓰기 권한 분리, 동의 거부 시 답변 저장 금지
begin;
select plan(17);
delete from public.answers; delete from public.content_photos; delete from public.content_questions; -- 시드와 무관하게 동작(이 트랜잭션 안에서만, 마지막에 rollback)

-- ---------- 시드 (테스트 트랜잭션 안에서만 존재, 마지막에 rollback) ----------
insert into auth.users (id, aud, role, is_anonymous) values
  ('a0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족A 자녀
  ('a0000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 가족A 어르신(동의함)
  ('a0000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),  -- 가족A 어르신2(동의 안 함)
  ('b0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족B 자녀
  ('b0000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 가족B 어르신(동의함)

insert into public.families (id, created_by) values
  ('fa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000c1'),
  ('fb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000c1');

insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('1a000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-000000000001', 'child', null),
  ('1a000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a1', 'fa000000-0000-0000-0000-000000000001', 'parent', now()),
  ('1a000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-0000000000a2', 'fa000000-0000-0000-0000-000000000001', 'parent', null),
  ('1b000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-0000000000c1', 'fb000000-0000-0000-0000-000000000001', 'child', null),
  ('1b000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000a1', 'fb000000-0000-0000-0000-000000000001', 'parent', now());

insert into public.content_questions (id, day_index, option_a, option_b) values
  ('c0000000-0000-0000-0000-000000000001', 1, '바다', '산'),
  ('c0000000-0000-0000-0000-000000000002', 2, '떡', '빵');

insert into public.answers (family_id, parent_id, question_id, choice) values
  ('fa000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'A'),
  ('fb000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'B');

insert into public.entitlements (family_id, plan_id, source) values
  ('fa000000-0000-0000-0000-000000000001', 'premium', 'free_period'),
  ('fb000000-0000-0000-0000-000000000001', 'premium', 'free_period');

insert into public.cheers (family_id, from_child, to_parent, message_key) values
  ('fa000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-0000000000c1', '1a000000-0000-0000-0000-0000000000a1', 'well_done');

-- ---------- 신원 전환 헬퍼 ----------
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- ---------- 테스트 ----------
-- 1~2. 가족A 자녀: 가족A 답변만 보임, 가족B 답변은 0행
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000c1', false);
select is((select count(*)::int from public.answers), 1, '자녀A는 가족A 답변 1건만 본다');
select is((select count(*)::int from public.answers where family_id = 'fb000000-0000-0000-0000-000000000001'), 0, '자녀A는 가족B 답변이 0행이다');
-- 3. 가족B 프로필/권한/응원이 안 보임
select is((select count(*)::int from public.profiles where family_id = 'fb000000-0000-0000-0000-000000000001'), 0, '자녀A는 가족B 프로필이 0행이다');
-- 4. 자녀는 답변을 쓸 수 없다
select throws_ok($$ insert into public.answers (family_id, parent_id, question_id, choice)
  values ('fa000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000002', 'A') $$,
  '42501', null, '자녀는 답변을 쓸 수 없다');
-- 5. 자녀는 daily_sessions를 직접 쓸 수 없다 (RPC 전용)
select throws_ok($$ insert into public.daily_sessions (family_id, parent_id, session_date)
  values ('fa000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-0000000000a1', current_date) $$,
  '42501', null, 'daily_sessions는 직접 쓸 수 없다');
-- 6. 콘텐츠는 읽기 전용
select throws_ok($$ insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'x', 'x', 'x') $$,
  '42501', null, '콘텐츠 테이블은 쓸 수 없다');
-- 7. 자녀는 가족 안 코드 목록을 볼 수 있고 시도 기록은 못 본다
select is((select count(*)::int from public.redeem_attempts), 0, '시도 기록 테이블은 정책이 없어 0행이다');

-- 8~9. 동의한 어르신A: 자기 답변 보임, 새 답변 저장 가능
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.answers), 1, '어르신A는 자기 답변 1건만 본다');
select lives_ok($$ insert into public.answers (family_id, parent_id, question_id, choice)
  values ('fa000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000002', 'B') $$,
  '동의한 어르신은 답변을 저장할 수 있다');
-- 10. 남의 parent_id로 쓰기 금지
select throws_ok($$ insert into public.answers (family_id, parent_id, question_id, choice)
  values ('fb000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000002', 'A') $$,
  '42501', null, '다른 가족 어르신 명의로 쓸 수 없다');
-- 11. 응원: 어르신은 message_key 수정 불가(read_at만)
select throws_ok($$ update public.cheers set message_key = 'hacked' $$,
  '42501', null, '어르신은 응원 내용을 수정할 수 없다');

-- 12. 동의하지 않은 어르신A2: 답변 저장 거부 (결정: 동의 거부 시 저장 안 함)
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a2', true);
select throws_ok($$ insert into public.answers (family_id, parent_id, question_id, choice)
  values ('fa000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-000000000001', 'A') $$,
  '42501', null, '동의하지 않은 어르신은 답변을 저장할 수 없다');

-- 13~14. 가족B 자녀: 가족A 권한(entitlements)/응원이 안 보임
select pg_temp.act_as('b0000000-0000-0000-0000-0000000000c1', false);
select is((select count(*)::int from public.entitlements where family_id = 'fa000000-0000-0000-0000-000000000001'), 0, '자녀B는 가족A entitlements가 0행이다');
select is((select count(*)::int from public.cheers), 0, '자녀B는 가족A 응원이 0행이다');

-- 15. anon 롤은 테이블 접근 자체가 막힘
reset role;
set local role anon;
select throws_ok($$ select * from public.answers $$, '42501', null, '로그인 전(anon)은 answers를 읽을 수 없다');

-- 16~17. 모든 public 테이블에 RLS가 켜져 있다 (새 테이블 누락 방지)
reset role;
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'public의 모든 테이블에 RLS가 켜져 있다');
select cmp_ok((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'), '>=', 12, '핵심 테이블 12개가 존재한다');

select * from finish();
rollback;
