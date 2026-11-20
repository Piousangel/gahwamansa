-- 0051 테스트 (pgTAP): dev_reset_today(staging QA S25 — 오늘 코스를 다시 해 P6 재현). 실행: npx supabase test db
-- 보호하는 것: 서버 스위치(server_flags.dev_reset_enabled)가 켜진 DB + 테스터 가족(is_test)의 어르신 본인만,
--             본인의 오늘(KST) daily_sessions·answers만 지운다(어제 기록·같은 가족 다른 어르신·콘텐츠 커서·응원·이벤트는 그대로), 감사 행.
--             자녀·프로필 없는 기기·anon은 실행 불가, 스위치 표는 앱·anon·서비스 역할이 읽거나 쓸 수 없다.
-- (11-20) 감사 행 단언은 이 테스트가 만든 가족·프로필로 한정한다 — DB에 다른 dev_reset_today 감사 행(1년 보관, 지울 수 없음)이 있어도 같은 결과.
begin;
select plan(24);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.daily_sessions; delete from public.content_photos; delete from public.content_questions;
delete from public.server_flags; -- 로컬 시드가 켜 둔 스위치를 지우고 테스트가 직접 정한다

insert into auth.users (id, aud, role, is_anonymous) values
  ('70510000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70510000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70510000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70510000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', true),
  ('70510000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true); -- 프로필 없음
insert into public.families (id, created_by, parent_title, is_test) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-0000000000c1', '엄마', true),
  ('70510000-0000-0000-0000-0000000000f2', '70510000-0000-0000-0000-0000000000c1', '엄마', false);
insert into public.profiles (id, user_id, family_id, role, consented_at, content_seq, content_seq_date) values
  ('70510000-0000-0000-0000-00000000c001', '70510000-0000-0000-0000-0000000000c1', '70510000-0000-0000-0000-0000000000f1', 'child', null, null, null),
  ('70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000a1', '70510000-0000-0000-0000-0000000000f1', 'parent', now(), 2, public.kst_today()),
  ('70510000-0000-0000-0000-00000000a002', '70510000-0000-0000-0000-0000000000a2', '70510000-0000-0000-0000-0000000000f1', 'parent', now(), 2, public.kst_today()),
  ('70510000-0000-0000-0000-00000000b001', '70510000-0000-0000-0000-0000000000b1', '70510000-0000-0000-0000-0000000000f2', 'parent', now(), 2, public.kst_today());
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('70510000-0000-0000-0000-0000000000d1', 1, '가을', '봄', 'q1'),
  ('70510000-0000-0000-0000-0000000000d2', 2, '바다', '산', 'q2');
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', public.kst_today(), '{photo,question}'),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', public.kst_today() - 1, '{photo,question,hangul}'),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a002', public.kst_today(), '{photo}'),
  ('70510000-0000-0000-0000-0000000000f2', '70510000-0000-0000-0000-00000000b001', public.kst_today(), '{photo}');
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000d2', 'A', public.kst_today()),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000d1', 'B', public.kst_today() - 1),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a002', '70510000-0000-0000-0000-0000000000d2', 'A', public.kst_today()),
  ('70510000-0000-0000-0000-0000000000f2', '70510000-0000-0000-0000-00000000b001', '70510000-0000-0000-0000-0000000000d2', 'B', public.kst_today());
insert into public.cheers (family_id, from_child, to_parent, message_key) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000c001', '70510000-0000-0000-0000-00000000a001', 'love_you');
insert into public.events (family_id, profile_id, actor_role, name, props) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', 'parent', 'course_step_completed', '{"step":"photo"}');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 스위치 꺼짐: 행이 없거나 enabled=false
select pg_temp.act_as('70510000-0000-0000-0000-0000000000a1', true);
select is(public.dev_reset_today(), '{"ok": false, "reason": "disabled"}'::jsonb, '스위치 행이 없으면 disabled');
reset role;
insert into public.server_flags (name, enabled) values ('dev_reset_enabled', false);
select pg_temp.act_as('70510000-0000-0000-0000-0000000000a1', true);
select is(public.dev_reset_today(), '{"ok": false, "reason": "disabled"}'::jsonb, '스위치가 꺼져 있으면 disabled');
reset role;
update public.server_flags set enabled = true where name = 'dev_reset_enabled';

-- 테스터 가족이 아니면 거부
select pg_temp.act_as('70510000-0000-0000-0000-0000000000b1', true);
select is(public.dev_reset_today(), '{"ok": false, "reason": "not_test_family"}'::jsonb, '테스터 가족이 아니면 not_test_family');
reset role;
select is((select count(*)::int from public.daily_sessions where parent_id = '70510000-0000-0000-0000-00000000b001')
        + (select count(*)::int from public.answers where parent_id = '70510000-0000-0000-0000-00000000b001'), 2, '거부되면 아무것도 지우지 않는다');
select is((select count(*)::int from public.admin_audit where action = 'dev_reset_today'
            and (target_family in ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-0000000000f2')
                 or target_profile in ('70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-00000000a002',
                                       '70510000-0000-0000-0000-00000000b001'))), 0,
          '거부·꺼짐은 감사 행 없음(가족 값이 비어 있는 감사 행이 생겨도 프로필로 잡는다)');

-- 정상: 본인의 오늘 것만
select pg_temp.act_as('70510000-0000-0000-0000-0000000000a1', true);
select is(public.dev_reset_today(), jsonb_build_object('ok', true, 'session_date', public.kst_today(), 'sessions', 1, 'answers', 1), '오늘 코스·답 1개씩 지우고 개수를 돌려준다');
reset role;
select is((select count(*)::int from public.daily_sessions where parent_id = '70510000-0000-0000-0000-00000000a001' and session_date = public.kst_today())
        + (select count(*)::int from public.answers where parent_id = '70510000-0000-0000-0000-00000000a001' and session_date = public.kst_today()), 0, '본인의 오늘 기록이 없다');
select is((select count(*)::int from public.daily_sessions where parent_id = '70510000-0000-0000-0000-00000000a001' and session_date = public.kst_today() - 1)
        + (select count(*)::int from public.answers where parent_id = '70510000-0000-0000-0000-00000000a001' and session_date = public.kst_today() - 1), 2, '어제 기록은 그대로');
select is((select count(*)::int from public.daily_sessions where parent_id = '70510000-0000-0000-0000-00000000a002')
        + (select count(*)::int from public.answers where parent_id = '70510000-0000-0000-0000-00000000a002'), 2, '같은 가족 다른 어르신의 오늘 기록은 그대로');
select ok((select content_seq = 2 and content_seq_date = public.kst_today() from public.profiles where id = '70510000-0000-0000-0000-00000000a001'),
          '콘텐츠 커서는 그대로(다시 열면 같은 날 콘텐츠)');
select is((select count(*)::int from public.cheers where to_parent = '70510000-0000-0000-0000-00000000a001')
        + (select count(*)::int from public.events where profile_id = '70510000-0000-0000-0000-00000000a001'), 2, '응원·이벤트는 그대로');
select is((select jsonb_build_object('op', operator, 't', target_profile, 'f', target_family, 'd', detail) from public.admin_audit where action = 'dev_reset_today'
             and target_profile = '70510000-0000-0000-0000-00000000a001'),
          jsonb_build_object('op', 'self', 't', '70510000-0000-0000-0000-00000000a001', 'f', '70510000-0000-0000-0000-0000000000f1',
                             'd', jsonb_build_object('session_date', public.kst_today(), 'sessions', 1, 'answers', 1)), '감사 행 1개(본인·가족·개수)');
-- 다시 해도 같은 날 콘텐츠로 시작(start_today는 커서를 다시 넘기지 않는다)
select is(public.advance_content_cursor('70510000-0000-0000-0000-00000000a001'), false,
          '초기화 뒤 오늘 코스를 다시 열어도(start_today 내부) 커서를 넘기지 않고 오늘 세션만 다시 만든다');
select pg_temp.act_as('70510000-0000-0000-0000-0000000000a1', true);
select is(public.dev_reset_today() - 'session_date', '{"ok": true, "sessions": 1, "answers": 0}'::jsonb, '다시 불러도 된다(다시 연 오늘 코스 1개)');
reset role;

-- 실행 권한
select pg_temp.act_as('70510000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.dev_reset_today() $$, '%parent_required%', '자녀는 실행할 수 없다');
select pg_temp.act_as('70510000-0000-0000-0000-0000000000e1', true);
select throws_like($$ select public.dev_reset_today() $$, '%parent_required%', '프로필 없는 기기는 실행할 수 없다');
reset role;
set local role anon;
select throws_ok($$ select public.dev_reset_today() $$, '42501', null, 'anon은 실행할 수 없다');
reset role;
select ok(not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r(role), unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p(priv)
                       where has_table_privilege(r.role, 'public.server_flags', p.priv)), '스위치 표는 앱·anon·서비스 역할이 읽거나 쓸 수 없다');
select ok(not has_function_privilege('service_role', 'public.dev_reset_today()', 'execute'), '서비스 역할도 실행하지 않는다(본인 세션 전용)');

-- 시드 원격 방지(PR #37 L1): Vault project_url이 있으면 시드가 스위치를 켜지 않는다
delete from public.server_flags;
delete from vault.secrets where name = 'project_url'; -- 트랜잭션 안(끝에 rollback)
select is(public.server_flag_seed_local('dev_reset_enabled'), true, '로컬(Vault project_url 없음)에서는 시드가 켠다');
select ok(public.server_flag('dev_reset_enabled'), '켜짐 확인');
delete from public.server_flags;
select vault.create_secret('https://ref.supabase.co', 'project_url');
select is(public.server_flag_seed_local('dev_reset_enabled'), false, '원격(Vault project_url 있음)이면 시드가 켜지지 않는다(--include-seed·--linked reset 방지)');
select ok(not public.server_flag('dev_reset_enabled'), '스위치는 꺼진 채(행 없음)');
select ok(not (has_function_privilege('authenticated', 'public.server_flag_seed_local(text)', 'execute')
            or has_function_privilege('anon', 'public.server_flag_seed_local(text)', 'execute')
            or has_function_privilege('service_role', 'public.server_flag_seed_local(text)', 'execute')), '시드 함수는 앱·anon·서비스 역할이 못 부른다');

select * from finish();
rollback;
