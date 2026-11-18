-- 0039 테스트 (pgTAP): 관리자 삭제(공통 삭제 함수)·감사 기록·콘텐츠 재고 뷰. 실행: npx supabase test db
-- 보호하는 것: 웹 삭제 요청 처리용 admin_delete_account·admin_delete_answers는 서비스 역할만, 사유·처리자 필수, 감사 행이 남는다.
--             계정 삭제는 앱의 delete_my_account와 같은 규칙(공통 함수): 자녀가 남으면 본인만, 마지막 자녀면 가족 전체 + 어르신 익명 계정, 인증 계정까지.
--             "답·참여 기록만"은 답과 코스 기록만 지우고 연결·동의는 둔다. 감사 행은 대상이 지워져도 남고, 고치거나 지울 수 없다(1년 뒤 파기 배치만).
--             content_runway는 서비스 역할만 본다.
begin;
select plan(22);
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70390000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70390000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70390000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70390000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70390000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', false),
  ('70390000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values
  ('7039f000-0000-0000-0000-000000000001', '70390000-0000-0000-0000-0000000000c1'),
  ('7039f000-0000-0000-0000-000000000002', '70390000-0000-0000-0000-0000000000d1');
insert into public.profiles (id, user_id, family_id, role, consented_at, content_seq) values
  ('7039b000-0000-0000-0000-0000000000c1', '70390000-0000-0000-0000-0000000000c1', '7039f000-0000-0000-0000-000000000001', 'child', null, null),
  ('7039b000-0000-0000-0000-0000000000c2', '70390000-0000-0000-0000-0000000000c2', '7039f000-0000-0000-0000-000000000001', 'child', null, null),
  ('7039b000-0000-0000-0000-0000000000a1', '70390000-0000-0000-0000-0000000000a1', '7039f000-0000-0000-0000-000000000001', 'parent', now(), 2),
  ('7039b000-0000-0000-0000-0000000000a2', '70390000-0000-0000-0000-0000000000a2', '7039f000-0000-0000-0000-000000000001', 'parent', now(), 1),
  ('7039b000-0000-0000-0000-0000000000d1', '70390000-0000-0000-0000-0000000000d1', '7039f000-0000-0000-0000-000000000002', 'child', null, null),
  ('7039b000-0000-0000-0000-0000000000b1', '70390000-0000-0000-0000-0000000000b1', '7039f000-0000-0000-0000-000000000002', 'parent', now(), null);
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'u', 'c', 'k'), (2, 'u', 'c', 'k'), (3, 'u', 'c', 'k'), (4, 'u', 'c', 'k');
insert into public.content_questions (id, day_index, option_a, option_b) values
  ('7039c000-0000-0000-0000-000000000001', 1, 'a', 'b'), ('7039c000-0000-0000-0000-000000000002', 2, 'a', 'b'),
  ('7039c000-0000-0000-0000-000000000003', 3, 'a', 'b'), ('7039c000-0000-0000-0000-000000000004', 4, 'a', 'b');
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('7039f000-0000-0000-0000-000000000001', '7039b000-0000-0000-0000-0000000000a1', '7039c000-0000-0000-0000-000000000001', 'A', public.kst_today() - 1),
  ('7039f000-0000-0000-0000-000000000001', '7039b000-0000-0000-0000-0000000000a1', '7039c000-0000-0000-0000-000000000002', 'B', public.kst_today());
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps) values
  ('7039f000-0000-0000-0000-000000000001', '7039b000-0000-0000-0000-0000000000a1', public.kst_today(), '{photo}');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 권한
select pg_temp.act_as('70390000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select public.admin_delete_account('7039b000-0000-0000-0000-0000000000a1', 'x', 'y') $$, '42501', null, '앱은 관리자 계정 삭제를 못 부른다');
select throws_ok($$ select public.admin_delete_answers('7039b000-0000-0000-0000-0000000000a1', 'x', 'y') $$, '42501', null, '앱은 관리자 답 삭제를 못 부른다');
select throws_ok($$ select count(*) from public.admin_audit $$, '42501', null, '앱은 감사 기록을 못 읽는다');
select throws_ok($$ select * from public.content_runway $$, '42501', null, '앱은 재고 뷰를 못 본다');
reset role;

-- 답·참여 기록만
set local role service_role;
select throws_like($$ select public.admin_delete_answers('7039b000-0000-0000-0000-0000000000a1', '', 'ops') $$, '%reason_required%', '사유가 없으면 거부');
select throws_like($$ select public.admin_delete_answers('7039b000-0000-0000-0000-0000000000a1', '메일 요청 #3', null) $$, '%operator_required%', '처리자가 없으면 거부');
select is(public.admin_delete_answers('7039b000-0000-0000-0000-0000000000a1', '메일 요청 #3', 'ops-hyun'), '{"ok": true, "answers": 2, "sessions": 1}'::jsonb, '답·코스 기록만 지운다');
select is(public.admin_delete_answers('7039b000-0000-0000-0000-0000000000c1', '잘못된 대상', 'ops-hyun') ->> 'reason', 'not_parent', '자녀 프로필은 답 삭제 대상이 아니다');
reset role;
select is((select count(*)::int from public.profiles where id = '7039b000-0000-0000-0000-0000000000a1' and consented_at is not null), 1, '연결·동의는 그대로');

-- 계정 삭제(공통 규칙)
set local role service_role;
select is(public.admin_delete_account('7039b000-0000-0000-0000-0000000000c1', '메일 요청 #4', 'ops-hyun') ->> 'scope', 'child', '자녀가 더 있으면 본인만');
select is(public.admin_delete_account('7039b000-0000-0000-0000-0000000000a2', '메일 요청 #5', 'ops-hyun') ->> 'scope', 'parent', '어르신 본인 기록');
select is(public.admin_delete_account('7039b000-0000-0000-0000-0000000000d1', '메일 요청 #6', 'ops-hyun') ->> 'scope', 'family', '마지막 자녀면 가족 전체');
select is(public.admin_delete_account('7039b000-0000-0000-0000-0000000000ff', '없음', 'ops-hyun') ->> 'reason', 'not_found', '없는 프로필은 not_found');
reset role;
select is((select count(*)::int from auth.users where id in ('70390000-0000-0000-0000-0000000000c1', '70390000-0000-0000-0000-0000000000a2', '70390000-0000-0000-0000-0000000000d1', '70390000-0000-0000-0000-0000000000b1')), 0,
          '인증 계정도 지워진다(가족 삭제 시 어르신 익명 계정 포함)');
select is((select count(*)::int from public.families where id = '7039f000-0000-0000-0000-000000000001'), 1, '자녀가 남은 가족은 그대로');
select is((select count(*)::int from auth.users where id = '70390000-0000-0000-0000-0000000000c2'), 1, '남은 자녀 계정은 그대로');

-- 감사
select is((select array_agg(action order by id) from public.admin_audit where target_profile::text like '7039b000%'),
          array['delete_answers', 'delete_account', 'delete_account', 'delete_account'], '처리마다 감사 행(실패한 not_found·not_parent 제외)');
select ok((select bool_and(operator = 'ops-hyun' and reason like '메일 요청%' and target_family is not null) from public.admin_audit where target_profile::text like '7039b000%'),
          '처리자·사유·가족이 남는다(대상이 지워져도)');
select throws_like($$ update public.admin_audit set reason = 'x' where target_profile::text like '7039b000%' $$, '%audit_immutable%', '감사 행은 고칠 수 없다');
select throws_like($$ delete from public.admin_audit where target_profile::text like '7039b000%' $$, '%audit_immutable%', '감사 행은 지울 수 없다(파기 배치 제외)');

-- 재고 뷰(심사 가족 제외, 남은 어르신 a1 커서 2 → 신규 남은 날 3·4)
set local role service_role;
select is((select remaining_new_days from public.content_runway), 2::bigint, '가장 앞선 커서 뒤로 남은 새 콘텐츠 날 수');
reset role;

-- 1년 지난 감사 행만 파기
insert into public.admin_audit (at, operator, action, target_profile, reason) values (now() - interval '13 months', 'ops', 'delete_answers', '7039b000-0000-0000-0000-0000000000aa', 'old');
select public.purge_expired_data();
select is((select count(*)::int from public.admin_audit where target_profile::text like '7039b000%'), 4, '1년 지난 감사 행만 지운다');

select * from finish();
rollback;
