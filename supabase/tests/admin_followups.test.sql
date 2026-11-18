-- 0043 테스트 (pgTAP): 관리자 삭제·콘텐츠 게시 리뷰 반영(2026-11-18-admin-delete-review M1~M3·C-M3·C-L1~L5). 실행: npx supabase test db
-- 보호하는 것: 앱이 실행할 수 있는 definer 함수는 허용 목록뿐(전역 회귀 감시), 공통 삭제 함수는 누구도 직접 못 부른다,
--             서비스 역할도 감사 행을 고치거나 지울 수 없고 파기 함수는 미래 시각을 받지 않는다, 계정 삭제가 동의 이력(D-05)·이벤트·발송 기록·토큰·응원까지 지운다,
--             답·참여 기록 삭제가 코스 이벤트도 지우고 다른 사람 것은 남긴다, 콘텐츠 은퇴는 중복 무시·최소 활성 날 유지, 게시 입력 검사, 서비스 역할 직접 쓰기 회수.
begin;
select plan(30);
select set_config('bumo.allow_content_delete', 'on', true);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

-- ---- 전역: 앱 실행 가능 definer 허용 목록 ----
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')),
          array['child_answer_history', 'child_summary', 'create_family', 'delete_my_account', 'delete_scope_preview', 'discard_anonymous_session',
                'get_my_cheers', 'get_today_content', 'give_consent', 'issue_invite_code', 'log_event', 'mark_cheers_read', 'my_consented', 'my_day_index',
                'my_family_id', 'my_profile_id', 'my_push_settings', 'my_role', 'my_week_stamps', 'parent_family_list', 'parent_history', 'peek_invite_code',
                'preview_content', 'record_session_step', 'redeem_invite_code', 'register_push_token', 'save_answer', 'send_cheer', 'set_parent_title',
                'set_parent_title_for', 'set_push_enabled', 'start_today', 'unregister_push_token', 'withdraw_consent'],
          '앱(authenticated)이 실행할 수 있는 definer 함수는 허용 목록과 같다(새 함수가 실수로 열리면 여기서 걸림)');
select ok(not (has_function_privilege('anon', 'public.account_delete_core(uuid)', 'execute')
            or has_function_privilege('authenticated', 'public.account_delete_core(uuid)', 'execute')
            or has_function_privilege('service_role', 'public.account_delete_core(uuid)', 'execute')),
          '공통 삭제 함수는 anon·앱·서비스 역할 모두 직접 못 부른다(감사 없는 삭제 차단)');
select ok(not (has_function_privilege('anon', 'public.admin_delete_account(uuid,text,text)', 'execute')
            or has_function_privilege('anon', 'public.admin_publish_content(jsonb,text,text)', 'execute')
            or has_function_privilege('authenticated', 'public.admin_retire_content(int,text,text)', 'execute')),
          'anon·앱은 관리자 함수를 못 부른다');

-- ---- M1: 감사 불변(서비스 역할 기준), 미래 시각 거부 ----
insert into public.admin_audit (operator, action, reason) values ('ops', 'delete_answers', 'x');
set local role service_role;
select set_config('bumo.allow_audit_purge', 'on', true);
select throws_ok($$ delete from public.admin_audit $$, '42501', null, '서비스 역할은 설정을 켜도 감사 행을 지울 수 없다');
select throws_ok($$ update public.admin_audit set reason = 'y' $$, '42501', null, '서비스 역할은 감사 행을 고칠 수 없다');
select throws_ok($$ truncate public.admin_audit $$, '42501', null, '서비스 역할은 감사 표를 비울 수 없다');
select throws_like($$ select public.purge_expired_data(now() + interval '2 years') $$, '%future_now%', '파기 함수는 미래 기준 시각을 받지 않는다');
select set_config('bumo.allow_audit_purge', 'off', true);
reset role;

-- ---- M3: 계정 삭제 정리 범위(D-05 포함) ----
insert into auth.users (id, aud, role, is_anonymous) values
  ('70430000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70430000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70430000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7043f000-0000-0000-0000-000000000001', '70430000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('7043b000-0000-0000-0000-0000000000c1', '70430000-0000-0000-0000-0000000000c1', '7043f000-0000-0000-0000-000000000001', 'child', null),
  ('7043b000-0000-0000-0000-0000000000a1', '70430000-0000-0000-0000-0000000000a1', '7043f000-0000-0000-0000-000000000001', 'parent', now()),
  ('7043b000-0000-0000-0000-0000000000a2', '70430000-0000-0000-0000-0000000000a2', '7043f000-0000-0000-0000-000000000001', 'parent', now());
insert into public.content_photos (day_index, image_url, caption, keyword) select d, 'https://x/' || d || '.jpg', 'c', 'k' from generate_series(1, 9) d;
insert into public.content_questions (id, day_index, option_a, option_b)
select ('7043c000-0000-0000-0000-00000000000' || d)::uuid, d, 'a', 'b' from generate_series(1, 9) d;
insert into public.answers (family_id, parent_id, question_id, choice) values
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000a1', '7043c000-0000-0000-0000-000000000001', 'A'),
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000a2', '7043c000-0000-0000-0000-000000000001', 'B');
insert into public.consent_events (parent_id, family_id, action, version) values
  ('7043b000-0000-0000-0000-0000000000a1', '7043f000-0000-0000-0000-000000000001', 'given', 'v2'),
  ('7043b000-0000-0000-0000-0000000000a2', '7043f000-0000-0000-0000-000000000001', 'given', 'v2');
insert into public.events (family_id, profile_id, actor_role, name, props) values
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000a1', 'parent', 'course_completed', '{"day_index": 3}'),
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000a1', 'parent', 'course_step_completed', '{"step": "photo"}'),
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000a1', 'parent', 'app_first_open', '{}'),
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000a2', 'parent', 'course_completed', '{}');
insert into public.cheers (family_id, from_child, to_parent, message_key) values
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000c1', '7043b000-0000-0000-0000-0000000000a1', 'love_you'),
  ('7043f000-0000-0000-0000-000000000001', '7043b000-0000-0000-0000-0000000000c1', '7043b000-0000-0000-0000-0000000000a2', 'love_you');
insert into public.device_tokens (user_id, token) values ('70430000-0000-0000-0000-0000000000a2', 'adm43_a2_000000000000001');
insert into public.push_log (kind, sent_on, profile_id, status) values ('daily', public.kst_today(), '7043b000-0000-0000-0000-0000000000a2', 'sent');
insert into public.push_claims (kind, sent_on, profile_id) values ('daily', public.kst_today(), '7043b000-0000-0000-0000-0000000000a2');

-- M2: 답·참여 기록만(코스 이벤트 포함), 다른 어르신·응원·동의는 남김
set local role service_role;
select is(public.admin_delete_answers('7043b000-0000-0000-0000-0000000000a1', '메일 요청', 'ops'), '{"ok": true, "answers": 1, "events": 2, "sessions": 0}'::jsonb,
          '답·코스 기록·코스 이벤트를 지운다');
reset role;
select is((select array_agg(name order by name) from public.events where profile_id = '7043b000-0000-0000-0000-0000000000a1'), array['app_first_open'], '코스와 무관한 이벤트는 남는다');
select is((select count(*)::int from public.answers where parent_id = '7043b000-0000-0000-0000-0000000000a2'), 1, '다른 어르신 답은 그대로');
select is((select count(*)::int from public.cheers where to_parent = '7043b000-0000-0000-0000-0000000000a1'), 1, '받은 응원은 그대로(답·참여 기록이 아님)');
select is((select count(*)::int from public.consent_events where parent_id = '7043b000-0000-0000-0000-0000000000a1'), 1, '동의 이력은 그대로(연결·동의 유지)');

-- 계정 삭제: 어르신 a2 → 관련 표 전부
set local role service_role;
select public.admin_delete_account('7043b000-0000-0000-0000-0000000000a2', '메일 요청', 'ops');
reset role;
select is((select count(*)::int from public.consent_events where parent_id = '7043b000-0000-0000-0000-0000000000a2'), 0, '계정 삭제는 동의 이력도 지운다(D-05)');
select is((select count(*)::int from public.events where profile_id = '7043b000-0000-0000-0000-0000000000a2'), 0, '이벤트도 지운다');
select is((select count(*)::int from public.push_log where profile_id = '7043b000-0000-0000-0000-0000000000a2')
        + (select count(*)::int from public.push_claims where profile_id = '7043b000-0000-0000-0000-0000000000a2'), 0, '발송 기록·선점도 지운다');
select is((select count(*)::int from public.device_tokens where user_id = '70430000-0000-0000-0000-0000000000a2'), 0, '토큰도 지운다');
select is((select count(*)::int from public.cheers where to_parent = '7043b000-0000-0000-0000-0000000000a2'), 0, '받은 응원도 지운다');

-- ---- C-M3·C-L2: 은퇴 ----
set local role service_role;
select is(public.admin_retire_content(1, '오타', 'ops'), '{"ok": true}'::jsonb, '은퇴(인자 순서: 날, 사유, 처리자 — 삭제 함수와 같음)');
select is(public.admin_retire_content(1, '오타', 'ops') ->> 'reason', 'already_retired', '이미 은퇴한 날은 다시 기록하지 않는다');
reset role;
select is((select count(*)::int from public.admin_audit where action = 'content_retire' and detail ->> 'day_index' = '1'), 1, '은퇴 감사 행은 한 번만');
select ok((select retired_at is not null from public.content_photos where day_index = 1) and (select retired_at is not null from public.content_questions where day_index = 1), '두 표 모두 은퇴 표시');
set local role service_role;
select public.admin_retire_content(2, 'x', 'ops');
select is(public.admin_retire_content(3, 'x', 'ops') ->> 'reason', 'too_few_active', '활성 날이 7일보다 적어지면 은퇴하지 않는다');

-- ---- C-L1·C-L3: 게시 입력 ----
select is(public.admin_publish_content(null, '추가', 'ops') ->> 'reason', 'invalid_item', 'p_days가 null이면 거부');
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 10, 'image_url', 'javascript:alert(1)', 'caption', 'c', 'keyword', 'k', 'option_a', 'a', 'option_b', 'b')), '추가', 'ops') ->> 'reason',
          'invalid_item', 'image_url은 공개 사진 버킷 주소만');
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 10, 'image_url', 'https://ref.supabase.co/storage/v1/object/public/content-photos/v2/day-10.jpg',
          'caption', repeat('가', 61), 'keyword', 'k', 'option_a', 'a', 'option_b', 'b')), '추가', 'ops') ->> 'reason', 'invalid_item', '설명 60자 넘으면 거부');
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 10, 'image_url', 'https://ref.supabase.co/storage/v1/object/public/content-photos/v2/day-10.jpg',
          'caption', 'c', 'keyword', 'k', 'option_a', 'a', 'option_b', 'b', 'recall_questions', jsonb_build_array(''))), '추가', 'ops') ->> 'reason', 'invalid_item', '빈 회상 질문은 거부');
select is(public.admin_publish_content(jsonb_build_array(jsonb_build_object('day_index', 10, 'image_url', 'https://ref.supabase.co/storage/v1/object/public/content-photos/v2/day-10.jpg',
          'caption', 'c', 'keyword', 'k', 'option_a', 'a', 'option_b', 'b')), '11월 추가', 'ops-hyun') ->> 'ok', 'true', '올바른 항목은 게시(인자 순서: 묶음, 사유, 처리자)');
reset role;
select is((select operator || '/' || reason from public.admin_audit where action = 'content_publish' order by id desc limit 1), 'ops-hyun/11월 추가', '감사 행의 처리자·사유가 바뀌지 않는다');

-- ---- C-L4: 서비스 역할 직접 쓰기 회수(사진 주소 갱신만 허용) ----
select ok(not (has_table_privilege('service_role', 'public.content_photos', 'insert') or has_table_privilege('service_role', 'public.content_questions', 'insert')
            or has_table_privilege('service_role', 'public.content_photos', 'delete') or has_table_privilege('service_role', 'public.content_photos', 'truncate')),
          '서비스 역할은 콘텐츠를 직접 넣거나 지울 수 없다(게시 RPC·감사로만)');
select ok(has_table_privilege('service_role', 'public.content_photos', 'update'), '사진 주소 갱신(upload-photos)은 남긴다(문구는 0024 트리거가 막음)');

select * from finish();
rollback;
