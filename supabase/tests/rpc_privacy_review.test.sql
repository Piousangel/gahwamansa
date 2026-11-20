-- 0014 리뷰 반영 테스트 (pgTAP). 근거: docs/team/reviews/2026-11-17-server-privacy-security.md
-- 보호하는 것: 자녀가 응원 read_at(어르신이 앱을 연 시각)이나 프로필의 동의·시작일 컬럼으로 참여 여부를 알아내지 못한다,
--             철회 후 재동의가 동작한다, 동의 문구 버전 형식 검증, 새 RPC는 anon이 실행하지 못한다
begin;
select plan(10);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('72000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('72000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7e000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, course_start_date) values
  ('7a000000-0000-0000-0000-0000000000c1', '72000000-0000-0000-0000-0000000000c1', '7e000000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('7a000000-0000-0000-0000-0000000000a1', '72000000-0000-0000-0000-0000000000a1', '7e000000-0000-0000-0000-000000000001', 'parent', null, public.kst_today());
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('7d000000-0000-0000-0000-000000000001', 1, '가을', '봄', '어느 계절이 좋으세요?');
insert into public.cheers (family_id, from_child, to_parent, message_key, read_at) values
  ('7e000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-0000000000c1', '7a000000-0000-0000-0000-0000000000a1', 'love_you', now());

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~3. 자녀: 응원 read_at·프로필 동의/시작일을 직접 읽지 못한다
select pg_temp.act_as('72000000-0000-0000-0000-0000000000c1', false);
select is((select count(*)::int from public.cheers), 0, '자녀는 응원 테이블을 직접 읽지 못한다(read_at 노출 차단)'); -- rls:의도 RLS 확인
select throws_ok($$ select consented_at from public.profiles $$, '42501', null, '자녀는 프로필의 동의 시각 컬럼을 읽지 못한다');
select throws_ok($$ select course_start_date from public.profiles $$, '42501', null, '자녀는 프로필의 시작일 컬럼을 읽지 못한다');

-- 4. 어르신은 자기에게 온 응원을 읽는다
select pg_temp.act_as('72000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.cheers), 1, '어르신은 자기에게 온 응원을 읽는다'); -- rls:의도 RLS 확인

-- 5~8. 동의 버전 검증, 철회 후 재동의
select throws_like($$ select public.give_consent('bad version') $$, '%invalid_version%', '형식이 틀린 동의 문구 버전은 거부된다');
select lives_ok($$ select public.give_consent('v2') $$, '올바른 버전으로 동의한다');
select public.save_answer('7d000000-0000-0000-0000-000000000001', 'A');
select public.withdraw_consent();
select lives_ok($$ select public.give_consent('v2') $$, '철회 후 다시 동의할 수 있다');
select lives_ok($$ select public.save_answer('7d000000-0000-0000-0000-000000000001', 'B') $$, '재동의 후 답을 저장할 수 있다');

-- 9~10. 새 RPC는 anon이 실행하지 못한다
reset role;
set local role anon;
select throws_ok($$ select public.child_summary() $$, '42501', null, 'anon은 child_summary를 실행하지 못한다');
select throws_ok($$ select public.withdraw_consent() $$, '42501', null, 'anon은 withdraw_consent를 실행하지 못한다');

select * from finish();
rollback;
