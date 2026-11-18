-- 0049 테스트 (pgTAP): xhigh 리뷰(2026-11-19 server-e1-e4-0048) 후속. 실행: npx supabase test db
-- 보호하는 것: M1 public 뷰로는 아무도 쓰기(insert·update·delete·truncate)를 못 한다(카카오 포기 목록으로 큐를 고치거나 지워 감사를 우회하지 못함),
--             M2 관리자 사유·처리자에 하이픈·공백·점으로 끊은 전화·카드 번호, 전각 ＠, "at … dot" 메일은 거부하고 uuid·짧은 접수 번호·날짜는 통과,
--             L1·법률 금지어는 정규화(NFKC)·보이지 않는 글자·문장부호를 걷어낸 뒤 검사하고 "유료"도 금지.
begin;
select plan(43);

-- M1: public 뷰 쓰기 권한 없음(서비스 역할 포함)
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace,
         unnest(array['service_role', 'authenticated', 'anon']) r(role), unnest(array['insert', 'update', 'delete', 'truncate']) p(priv)
   where n.nspname = 'public' and c.relkind in ('v', 'm') and has_table_privilege(r.role, c.oid, p.priv)),
  'public 뷰에는 서비스 역할·앱·anon 누구도 insert·update·delete·truncate 권한이 없다');
select ok(has_table_privilege('service_role', 'public.kakao_unlink_gave_up', 'select') and has_table_privilege('service_role', 'public.content_runway', 'select'),
          '서비스 역할은 포기 목록·콘텐츠 남은 날 뷰를 읽을 수는 있다');
insert into public.kakao_unlink_queue (id, kakao_user_id, attempts, gave_up_at) values (9049, 'k-9049', 5, now());
set local role service_role;
select throws_ok($$ update public.kakao_unlink_gave_up set gave_up_at = null, attempts = 0 where id = 9049 $$, '42501', null, '서비스 역할은 포기 목록 뷰로 큐를 고칠 수 없다');
select throws_ok($$ delete from public.kakao_unlink_gave_up where id = 9049 $$, '42501', null, '서비스 역할은 포기 목록 뷰로 큐를 지울 수 없다');
select throws_ok($$ insert into public.kakao_unlink_gave_up (id) values (9050) $$, '42501', null, '서비스 역할은 포기 목록 뷰에 넣을 수 없다');
reset role;
select is((select attempts from public.kakao_unlink_queue where id = 9049), 5, '큐 행은 그대로');

-- M2: 거부
select throws_like($$ select public.admin_check_args('전화 010-1234-5678 요청', 'ops') $$, '%pii_in_args%', '하이픈 전화번호 거부');
select throws_like($$ select public.admin_check_args('010 1234 5678', 'ops') $$, '%pii_in_args%', '띄어 쓴 전화번호 거부');
select throws_like($$ select public.admin_check_args('010.1234.5678', 'ops') $$, '%pii_in_args%', '점으로 끊은 전화번호 거부');
select throws_like($$ select public.admin_check_args('카드 1234-5678-9012-3456', 'ops') $$, '%pii_in_args%', '하이픈 카드번호 거부');
select throws_like($$ select public.admin_check_args('mom＠gmail.com', 'ops') $$, '%pii_in_args%', '전각 ＠ 메일 거부');
select throws_like($$ select public.admin_check_args('mom at gmail dot com', 'ops') $$, '%pii_in_args%', '"at … dot" 메일 거부');
select throws_like($$ select public.admin_check_args('요청', '０１０１２３４５６７８') $$, '%pii_in_args%', '전각 숫자 전화번호 거부');
select throws_like($$ select public.admin_check_args('접수 202611190001', 'ops') $$, '%pii_in_args%', '9자리 이상 숫자는 접수 번호라도 거부(규칙: 8자리 이하 또는 #n)');
-- M2: 통과
select lives_ok($$ select public.admin_check_args('가족 3f2a9c1e-0000-4abc-8def-123456789012 정리', 'ops') $$, 'uuid(끝 묶음이 숫자)는 통과');
select lives_ok($$ select public.admin_check_args('가족 3F2A9C1E-0000-4ABC-8DEF-123456789012', 'ops') $$, '대문자 uuid도 통과');
select lives_ok($$ select public.admin_check_args('메일 요청 #3(11-19 접수)', 'ops-hyun') $$, '접수 번호 #n·날짜는 통과');
select lives_ok($$ select public.admin_check_args('접수 20261119 처리', 'ops') $$, '8자리 접수 번호는 통과');
select lives_ok($$ select public.admin_check_args('2026-11-19 접수 #12', 'ops') $$, '연-월-일 날짜는 통과');
select lives_ok($$ select public.admin_check_args('11월 3주차 추가', 'ops') $$, '콘텐츠 사유는 통과');
select lives_ok($$ select public.admin_check_args('staging 테스트 가족 정리(개발자 메뉴)', 'ops') $$, '테스트 가족 정리 사유는 통과');

-- L1·법률: 금지어 정규화
select ok(not public.push_text_clean(normalize('할인', NFD)), 'NFD로 쪼갠 금지어 거부');
select ok(not public.push_text_clean(U&'할\00AD인'), 'soft hyphen(U+00AD)을 끼운 금지어 거부');
select ok(not public.push_text_clean(U&'할\3164인'), '한글 채움(U+3164)을 끼운 금지어 거부');
select ok(not public.push_text_clean(U&'할\034F인'), 'CGJ(U+034F)를 끼운 금지어 거부');
select ok(not public.push_text_clean(U&'할\2063인'), '보이지 않는 구분자(U+2063)를 끼운 금지어 거부');
select ok(not public.push_text_clean('혜·택') and not public.push_text_clean('할.인') and not public.push_text_clean('쿠-폰'), '문장부호를 끼운 금지어 거부');
select ok(not public.push_text_clean('곧 유료로 바뀌어요') and not public.push_text_clean('유 료'), '"유료" 거부(방침 2절·load-push-copy와 같은 목록)');
select ok(public.push_text_clean('오늘 사진이 왔어요. 함께 볼까요?') and public.push_text_clean('{호칭}, 따뜻한 하루 보내세요!'), '정상 문구는 통과');
delete from public.cheer_texts where message_key = 'love_you'; -- 트랜잭션 안(끝에 rollback)
select throws_ok($$ insert into public.cheer_texts (message_key, text) values ('love_you',U&'적\00AD립 해 드려요') $$, '23514', null, '응원 문장 제약도 새 규칙으로 검사');
select ok(not exists (select 1 from public.push_copy where not (public.push_text_clean(title) and public.push_text_clean(body)
                                                               and public.push_text_clean(body_fallback) and public.push_text_clean(body_many)))
      and not exists (select 1 from public.cheer_texts where not public.push_text_clean(text)), '기존 문구 행은 모두 새 규칙을 통과');

-- 법률 M1(P20): 가족 연결 전(프로필 없음) 계정 삭제 — 본인 경로·운영자 경로
insert into auth.users (id, aud, role, is_anonymous) values
  ('70490000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 연결 전 카카오 자녀(본인 삭제)
  ('70490000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 연결 전 익명(운영자 삭제)
  ('70490000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false); -- 가족 있는 자녀(운영자 경로 거부)
insert into auth.identities (provider_id, user_id, identity_data, provider) values ('kakao-704901', '70490000-0000-0000-0000-0000000000c1', '{}', 'kakao');
insert into public.terms_agreements (user_id, role, terms_version, privacy_version) values
  ('70490000-0000-0000-0000-0000000000c1', 'none', 'v1', 'v1'), ('70490000-0000-0000-0000-0000000000a1', 'none', 'v1', 'v1');
insert into public.device_tokens (user_id, token) values ('70490000-0000-0000-0000-0000000000c1', 'tok-7049-c1');
insert into public.families (id, created_by) values ('70490000-0000-0000-0000-0000000000f1', '70490000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, user_id, family_id, role) values ('70490000-0000-0000-0000-0000000000e1', '70490000-0000-0000-0000-0000000000c2', '70490000-0000-0000-0000-0000000000f1', 'child');
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70490000-0000-0000-0000-0000000000c1', false);
select is(public.delete_scope_preview(), '{"scope": "none"}'::jsonb, '연결 전 계정의 삭제 범위는 none(본인 계정·동의 기록만)');
select is(public.delete_my_account(), '{"scope": "none"}'::jsonb, '연결 전 계정도 스스로 지울 수 있다');
reset role;
select is((select count(*)::int from auth.users where id = '70490000-0000-0000-0000-0000000000c1')
        + (select count(*)::int from public.terms_agreements where user_id = '70490000-0000-0000-0000-0000000000c1')
        + (select count(*)::int from public.device_tokens where user_id = '70490000-0000-0000-0000-0000000000c1'), 0,
          '인증 계정·동의 기록·푸시 토큰이 함께 지워진다');
select is((select count(*)::int from public.kakao_unlink_queue where kakao_user_id = 'kakao-704901'), 1, '카카오 회원번호는 연결 끊기 큐에 들어간다');

set local role service_role;
select is(public.admin_delete_user('70490000-0000-0000-0000-0000000000a1', '메일 요청 #7(11-19 접수)', 'ops'), '{"ok": true, "scope": "none"}'::jsonb,
          '운영자는 프로필 없는 계정을 지울 수 있다');
select is(public.admin_delete_user('70490000-0000-0000-0000-0000000000a1', '메일 요청 #7', 'ops') ->> 'reason', 'not_found', '없는 계정은 not_found');
select is(public.admin_delete_user('70490000-0000-0000-0000-0000000000c2', '메일 요청 #8', 'ops') ->> 'reason', 'has_profile',
          '가족이 있는 계정은 has_profile(admin_delete_account를 쓴다)');
select throws_ok($$ select public.user_delete_core('70490000-0000-0000-0000-0000000000c2') $$, '42501', null, '내부 삭제 함수는 서비스 역할도 직접 못 부른다(감사 우회 차단)');
reset role;
select is((select count(*)::int from auth.users where id = '70490000-0000-0000-0000-0000000000a1')
        + (select count(*)::int from public.terms_agreements where user_id = '70490000-0000-0000-0000-0000000000a1'), 0, '익명 계정·동의 기록 삭제');
select is((select count(*)::int from public.admin_audit where action = 'delete_user' and detail ->> 'user_id' = '70490000-0000-0000-0000-0000000000a1'), 1,
          '운영자 삭제는 감사 행 1개(성공한 것만)');
select is((select count(*)::int from public.profiles where user_id = '70490000-0000-0000-0000-0000000000c2'), 1, '가족 있는 계정은 그대로');
select ok(not has_function_privilege('authenticated', 'public.admin_delete_user(uuid, text, text)', 'execute')
      and not has_function_privilege('anon', 'public.admin_delete_user(uuid, text, text)', 'execute'), '앱·anon은 운영자 삭제를 못 부른다');

select * from finish();
rollback;
