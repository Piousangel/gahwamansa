-- 0061 테스트 (pgTAP): 오늘 코스 5단계 서버 계약. 실행: npx supabase test db
-- 보호하는 것:
--   (1) 완료(도장) 판정 — 옛 앱 3단계(2인자 호출) 그대로 / 새 앱 5단계는 ⑤까지 '했어요 또는 넘어감'일 때만 / ③ 뒤 '오늘은 여기까지'도 완료 /
--       전부 넘김도 완료 / 순서를 건너뛰어도 5단계 코스는 ⑤ 전에 찍히지 않음 / 옛 앱·새 앱 어르신이 한 가족에 섞여도 각자 맞게.
--   (2) ② 고른 것·(3) ⑤ 건넨 말: 정해진 보기 번호·틀 키만, P2 동의 중에만, ⑤는 서버 스위치(기본 꺼짐) 켜졌을 때만, 넘기면 지움.
--   (4) 지우는 길: 그만 보여 주기·31일 파기·관리자 계정 삭제·오늘 다시 하기(dev_reset_today)에 모두 포함.
--   (5) 자녀 읽기 범위: 동의 중·같은 가족·30일, 넘긴 날 무표시, 스위치 꺼짐이면 ⑤ 없음. 앱·anon·서비스 역할의 표 직접 접근 불가.
begin;
select plan(85);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외

-- ---- 스위치 기본 꺼짐(픽스처가 손대기 전, 마이그레이션·로컬 시드 그대로) ----
select ok(not exists (select 1 from public.server_flags where name = 'pass_on_store_enabled' and enabled),
          '⑤ 저장 스위치는 기본 꺼짐(마이그레이션·시드가 켜지 않는다, 법률 L-11 전)');

delete from public.answers; delete from public.daily_sessions; delete from public.content_photos; delete from public.content_questions;
delete from public.server_flags where name = 'pass_on_store_enabled';

insert into auth.users (id, aud, role, is_anonymous) values
  ('70610000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70610000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70610000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70610000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70610000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true),
  ('70610000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', true),
  ('70610000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', true),
  ('70610000-0000-0000-0000-0000000000e5', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values
  ('70610000-0000-0000-0000-0000000000f1', '70610000-0000-0000-0000-0000000000c1', '엄마'),
  ('70610000-0000-0000-0000-0000000000f2', '70610000-0000-0000-0000-0000000000c2', '엄마');
insert into public.content_photos (day_index, image_url, caption, keyword) values
  (1, 'u1', '시골집 부엌', '부엌'), (2, 'u2', '마을 입구', '나무'), (3, 'u3', '감 익는 마당', '감'); -- 3일은 ② 보기 없음
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('70610000-0000-0000-0000-0000000000d1', 1, '숭늉', '식혜', '무엇이 당기세요?'),
  ('70610000-0000-0000-0000-0000000000d2', 2, '봄', '가을', '어느 계절이 좋으세요?'),
  ('70610000-0000-0000-0000-0000000000d3', 3, '단감', '홍시', '어느 쪽이 좋으세요?');
insert into public.content_recall_options (day_index, slot, label) values
  (1, 1, '아궁이'), (1, 2, '누룽지'), (1, 3, '가마솥'), (2, 1, '정자'), (2, 2, '장독');
-- a1 새 앱(동의) · a2 옛 앱(동의) · a3 미동의 · a4 새 앱(동의, 넘기기) — 가족 f1. b1 다른 가족(동의).
insert into public.profiles (id, user_id, family_id, role, consented_at, content_seq, content_seq_date, created_at) values
  ('70610000-0000-0000-0000-00000000c001', '70610000-0000-0000-0000-0000000000c1', '70610000-0000-0000-0000-0000000000f1', 'child', null, null, null, '2026-11-01 00:00+00'),
  ('70610000-0000-0000-0000-00000000c002', '70610000-0000-0000-0000-0000000000c2', '70610000-0000-0000-0000-0000000000f2', 'child', null, null, null, '2026-11-01 00:00+00'),
  ('70610000-0000-0000-0000-00000000a001', '70610000-0000-0000-0000-0000000000a1', '70610000-0000-0000-0000-0000000000f1', 'parent', now(), 1, public.kst_today(), '2026-11-02 00:00+00'),
  ('70610000-0000-0000-0000-00000000a002', '70610000-0000-0000-0000-0000000000a2', '70610000-0000-0000-0000-0000000000f1', 'parent', now(), 1, public.kst_today(), '2026-11-03 00:00+00'),
  ('70610000-0000-0000-0000-00000000a003', '70610000-0000-0000-0000-0000000000a3', '70610000-0000-0000-0000-0000000000f1', 'parent', null, 1, public.kst_today(), '2026-11-04 00:00+00'),
  ('70610000-0000-0000-0000-00000000a004', '70610000-0000-0000-0000-0000000000a4', '70610000-0000-0000-0000-0000000000f1', 'parent', now(), 1, public.kst_today(), '2026-11-05 00:00+00'),
  ('70610000-0000-0000-0000-00000000b001', '70610000-0000-0000-0000-0000000000b1', '70610000-0000-0000-0000-0000000000f2', 'parent', now(), 1, public.kst_today(), '2026-11-06 00:00+00'),
  ('70610000-0000-0000-0000-00000000e005', '70610000-0000-0000-0000-0000000000e5', '70610000-0000-0000-0000-0000000000f2', 'parent', now(), 3, public.kst_today(), '2026-11-07 00:00+00');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create function pg_temp.sess(p uuid) returns public.daily_sessions language sql as $$
  select * from public.daily_sessions where parent_id = p and session_date = public.kst_today()
$$;
grant execute on function pg_temp.sess(uuid) to public;

-- ======== (1) 완료 판정 ========
-- 옛 앱(a2): 지금 앱이 보내는 2인자 호출 그대로
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a2', true);
select is(public.record_session_step('photo', 10), '{"completed": false, "steps": ["photo"], "streak": 0}'::jsonb, '옛 앱: 2인자 호출이 그대로 풀리고 반환 모양도 같다');
select public.record_session_step('question', 20);
select is(public.record_session_step('hangul', 30) ->> 'completed', 'true', '옛 앱: 옛 3단계를 마치면 완료(도장)');
-- 새 앱(a1): 모든 호출에 p_course_len = 5
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select public.record_session_step('photo', 10, false, 5);
select is(public.save_recall(1, 2), '{"ok": true}'::jsonb, '동의한 어르신은 ② 보기 번호를 저장한다');
select public.record_session_step('recall', 15, false, 5);
select public.save_answer('70610000-0000-0000-0000-0000000000d1', 'A');
select public.record_session_step('question', 20, false, 5);
select is(public.record_session_step('hangul', 30, false, 5) ->> 'completed', 'false', '새 앱: 옛 3단계를 다 해도 ⑤ 전에는 완료가 아니다');
select is(public.record_session_step('pass_on', 40, true, 5) ->> 'completed', 'true', '새 앱: ⑤를 넘겨도 다섯 단계가 차면 완료');
reset role;
select is((pg_temp.sess('70610000-0000-0000-0000-00000000a001')).course_len, 5::smallint, '새 앱 세션은 course_len 5');
select is((pg_temp.sess('70610000-0000-0000-0000-00000000a002')).course_len, 3::smallint, '옛 앱 세션은 course_len 3(같은 가족에 새 앱 어르신이 있어도 각자)');
select is((pg_temp.sess('70610000-0000-0000-0000-00000000a001')).skipped_steps, array['pass_on'], '넘긴 단계는 skipped_steps에 남는다');

-- '오늘은 여기까지'(a4): ③ 전에는 거부, ③ 뒤면 ④·⑤를 넘어감으로 채워 완료
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a4', true);
select public.record_session_step('photo', 10, false, 5);
select throws_like($$ select public.record_session_step('stop_here', 0, false, 5) $$, '%stop_before_question%', '여기까지는 ③을 마치기 전에는 거부');
select public.record_session_step('recall', 5, true, 5);
select public.record_session_step('question', 5, true, 5);
select is(public.record_session_step('stop_here', 0, false, 5) ->> 'completed', 'true', '③ 뒤 여기까지 = 완료(도장)');
reset role;
select is((pg_temp.sess('70610000-0000-0000-0000-00000000a004')).skipped_steps, array['hangul', 'pass_on', 'question', 'recall'],
          '여기까지는 남은 ④·⑤를 넘어감으로 기록(앞서 넘긴 ②③과 함께, 전부 넘김도 완료)');
select ok((pg_temp.sess('70610000-0000-0000-0000-00000000a004')).stopped_here, '여기까지로 마친 날 표지');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a4', true);
select public.record_session_step('hangul', 50, false, 5);
reset role;
select is((pg_temp.sess('70610000-0000-0000-0000-00000000a004')).skipped_steps, array['pass_on', 'question', 'recall'],
          '여기까지 뒤 ④를 다시 하면 넘어감에서 빠진다(시안 4: 홈에서 다시 하기)');

-- 순서를 건너뛴 새 앱(b1): ①③④만 해도 5단계 코스는 완료가 아니다(옛 규칙으로 일찍 찍히지 않음)
select pg_temp.act_as('70610000-0000-0000-0000-0000000000b1', true);
select public.record_session_step('photo', 1, false, 5);
select public.record_session_step('question', 1, false, 5);
select is(public.record_session_step('hangul', 1, false, 5) ->> 'completed', 'false', '5단계 코스는 ②·⑤ 없이 완료되지 않는다(순서를 건너뛰어도)');
select throws_like($$ select public.record_session_step('photo', 1, true, 5) $$, '%invalid_step%', '① 사진 보기는 넘어갈 수 없다');
select throws_like($$ select public.record_session_step('photo', 1, false, 6) $$, '%invalid_course_len%', '코스 길이는 3·4·5만(4는 0067)');
select throws_like($$ select public.record_session_step('sound', 1) $$, '%invalid_step%', '목록 밖 단계 거부');
select is(public.record_session_step('recall', 1, false, 3) ->> 'completed', 'false', '새 단계를 기록하면 p_course_len 없이도 5단계 코스로 본다');
reset role;
select is((pg_temp.sess('70610000-0000-0000-0000-00000000b001')).course_len, 5::smallint, '코스 길이는 줄지 않는다(5 → 3 호출에도 5)');

-- ======== (2) ② 저장 조건 ========
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a3', true);
select public.record_session_step('photo', 1, false, 5);
select is(public.save_recall(1, 1), '{"ok": false, "reason": "consent_required"}'::jsonb, 'P2 동의가 없으면 ② 저장 거부');
reset role;
select is((select count(*)::int from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000a003'), 0, '동의 없을 때 ② 행 0');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select is(public.save_recall(2, 1), '{"ok": false, "reason": "stale_day"}'::jsonb, '오늘 콘텐츠 날이 아닌 보기(자정 넘김 등) 거부');
select is(public.save_recall(1, 4), '{"ok": false, "reason": "invalid_option"}'::jsonb, '정해진 보기 밖 번호 거부');
select is(public.save_recall(1, null), '{"ok": false, "reason": "invalid_option"}'::jsonb, '번호 없음 거부');
select is(public.get_today_content() -> 'recall', '{"options": [{"slot": 1, "label": "아궁이"}, {"slot": 2, "label": "누룽지"}, {"slot": 3, "label": "가마솥"}], "picked_slot": 2}'::jsonb,
          '어르신 오늘 콘텐츠에 ② 보기 3개와 고른 번호');
select is(public.get_today_content() -> 'skipped_steps', '["pass_on"]'::jsonb, '어르신 오늘 콘텐츠에 넘긴 단계');
select is(public.get_today_content() -> 'pass_on', '{"enabled": false, "picked_key": null}'::jsonb, '스위치 꺼짐을 앱이 안다');
reset role;
select is((select array_agg(format_type(a.atttypid, a.atttypmod)::text order by a.attnum) from pg_attribute a
            where a.attrelid = 'public.recall_picks'::regclass and a.attnum > 0 and not a.attisdropped),
          array['uuid', 'uuid', 'date', 'integer', 'smallint', 'timestamp with time zone'], '② 표에는 글자 칸이 없다(보기 번호만, 자유 글 저장 불가)');
select throws_ok($$ insert into public.content_recall_options (day_index, slot, label) values (2, 3, '연탄 나르던 길') $$, '23514', null,
                 '보기 낱말은 띄어쓰기 없는 한글 한 낱말만');
select throws_ok($$ insert into public.content_recall_options (day_index, slot, label) values (2, 3, '떡') $$, '23514', null,
                 '보기 낱말은 2~4자(라이터 2절 조사 판정 조건)');
select throws_like($$ update public.content_recall_options set label = '부뚜막' where day_index = 1 and slot = 1 $$, '%content_immutable%', '게시된 보기는 고칠 수 없다');

-- ======== (3) ⑤ 저장 조건 ========
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select is(public.save_pass_on(1, 'recall_story'), '{"ok": false, "reason": "disabled"}'::jsonb, '스위치 꺼짐이면 ⑤ 저장 거부(동의해도)');
reset role;
select is((select count(*)::int from public.pass_on_picks), 0, '스위치 꺼짐 거부 뒤 ⑤ 행 0');
insert into public.server_flags (name, enabled) values ('pass_on_store_enabled', true);
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a3', true);
select is(public.save_pass_on(1, 'ask_which'), '{"ok": false, "reason": "consent_required"}'::jsonb, '스위치 켬이어도 동의가 없으면 거부');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select is(public.save_pass_on(1, '오늘 잘 지내요'), '{"ok": false, "reason": "invalid_key"}'::jsonb, '자유 문장 거부(틀 키만)');
select is(public.save_pass_on(1, 'love_you'), '{"ok": false, "reason": "invalid_key"}'::jsonb, '응원 키는 ⑤ 키가 아니다(다른 목록)');
select is(public.save_pass_on(2, 'ask_which'), '{"ok": false, "reason": "stale_day"}'::jsonb, '⑤도 오늘 콘텐츠 날만');
select is(public.save_pass_on(1, 'recall_story'), '{"ok": false, "reason": "skipped"}'::jsonb, '⑤를 넘긴 날은 저장 거부(넘김 → 저장 순서도 무표시, QA-3 M1)');
select public.record_session_step('pass_on', 5, false, 5); -- 홈에서 다시 하기: 실제로 하면 skipped에서 빠진다
select is(public.save_pass_on(1, 'recall_story'), '{"ok": true}'::jsonb, '다시 한 ⑤는 스위치 켬 + 동의 + ② 있음 → 저장');
select is(public.get_today_content() -> 'pass_on', '{"enabled": true, "picked_key": "recall_story"}'::jsonb, '어르신 오늘 콘텐츠에 건넨 키');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000b1', true);
select is(public.save_pass_on(1, 'recall_story'), '{"ok": false, "reason": "missing_value"}'::jsonb, '② 없이 recall_story 거부(빈 자리 문장 방지)');
select is(public.save_pass_on(1, 'choice_like'), '{"ok": false, "reason": "missing_value"}'::jsonb, '③ 답 없이 choice_like 거부');
select public.save_answer('70610000-0000-0000-0000-0000000000d1', 'B');
select is(public.save_pass_on(1, 'choice_like'), '{"ok": true}'::jsonb, '③ 답이 있으면 choice_like 저장');
select public.record_session_step('question', 5, true, 5);
reset role;
select is((select count(*)::int from public.answers where parent_id = '70610000-0000-0000-0000-00000000b001' and session_date = public.kst_today())
        + (select count(*)::int from public.pass_on_picks where parent_id = '70610000-0000-0000-0000-00000000b001'), 0,
          '③ 넘김 → 오늘 답과 그 답을 끼운 ⑤ choice_like 삭제(QA-1 M3·QA-3 L1)');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000b1', true);
select throws_like($$ select public.save_answer('70610000-0000-0000-0000-0000000000d1', 'A') $$, '%skipped%', '③을 넘긴 날은 save_answer도 거부(예외 skipped)');
select is(public.save_pass_on(1, 'ask_which'), '{"ok": true}'::jsonb, 'ask_which 저장');
select public.record_session_step('pass_on', 5, true, 5);
reset role;
select is((select count(*)::int from public.pass_on_picks where parent_id = '70610000-0000-0000-0000-00000000b001'), 0, '⑤ 넘김 → ⑤ 행 삭제(QA-1 M3)');
-- ② 보기가 없는 날(3일, e5): no_content. 앱은 ②를 p_skipped로 기록(계약 규칙), stop_here는 빠진 ②까지 채운다(QA-1 M1)
select pg_temp.act_as('70610000-0000-0000-0000-0000000000e5', true);
select public.record_session_step('photo', 5, false, 5);
select is(public.save_recall(3, 1), '{"ok": false, "reason": "no_content"}'::jsonb, '② 보기가 없는 날 save_recall은 no_content');
select is(public.get_today_content() -> 'recall' -> 'options', '[]'::jsonb, '보기 없는 날 options는 빈 배열');
select is(public.get_today_content() ->> 'five_steps_supported', 'true', '0061 계약 표지(QA-1 L5)');
select public.record_session_step('question', 5, false, 5);
select is(public.record_session_step('stop_here', 0, false, 5) ->> 'completed', 'true', '② 기록이 빠진 날도 여기까지면 도장(빠진 ②를 넘어감으로 채움)');
reset role;
select is((pg_temp.sess('70610000-0000-0000-0000-00000000e005')).skipped_steps, array['hangul', 'pass_on', 'recall'], '여기까지가 채운 넘어감 = ②·④·⑤');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.save_recall(1, 1) $$, '%parent_required%', '자녀는 ② 저장 불가');
select throws_like($$ select public.save_pass_on(1, 'ask_which') $$, '%parent_required%', '자녀는 ⑤ 저장 불가');

-- ======== (5) 자녀 읽기 ========
select pg_temp.act_as('70610000-0000-0000-0000-0000000000c1', false);
select is((select jsonb_object_agg(p ->> 'parent_id', jsonb_build_object('r', p -> 'recalls', 'p', p -> 'pass_ons'))
             from jsonb_array_elements(public.child_answer_history() -> 'parents') p),
          jsonb_build_object(
            '70610000-0000-0000-0000-00000000a001', jsonb_build_object(
              'r', jsonb_build_array(jsonb_build_object('session_date', public.kst_today(), 'label', '누룽지')),
              'p', jsonb_build_array(jsonb_build_object('session_date', public.kst_today(), 'line_key', 'recall_story', 'recall_label', '누룽지',
                                                        'choice_label', '숭늉', 'option_a', '숭늉', 'option_b', '식혜'))),
            '70610000-0000-0000-0000-00000000a002', jsonb_build_object('r', '[]'::jsonb, 'p', '[]'::jsonb),
            '70610000-0000-0000-0000-00000000a003', jsonb_build_object('r', '[]'::jsonb, 'p', '[]'::jsonb),
            '70610000-0000-0000-0000-00000000a004', jsonb_build_object('r', '[]'::jsonb, 'p', '[]'::jsonb)),
          '자녀: 동의한 어르신의 ②·⑤만, 넘긴 날(a4)·옛 앱(a2)·미동의(a3)는 무표시');
select throws_ok($$ select count(*) from public.recall_picks $$, '42501', null, '자녀는 ② 표를 직접 읽지 못한다');
select throws_ok($$ select count(*) from public.pass_on_picks $$, '42501', null, '자녀는 ⑤ 표를 직접 읽지 못한다');
select throws_ok($$ select count(*) from public.content_recall_options $$, '42501', null, '앱은 보기 표를 직접 읽지 못한다(RPC로만)');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000c2', false);
select is((select count(*)::int from jsonb_array_elements(public.child_answer_history() -> 'parents') p
            where p ->> 'parent_id' like '70610000-0000-0000-0000-00000000a00%'), 0, '다른 가족 자녀에게는 f1 어르신 항목이 없다');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select is(public.parent_preview_child_view() -> 'history' -> 'parents' -> 0 -> 'recalls',
          jsonb_build_array(jsonb_build_object('session_date', public.kst_today(), 'label', '누룽지')), '어르신 미리보기도 자녀와 같은 ② 값');
select is((select d -> 'recall_label' from jsonb_array_elements(public.parent_history(1) -> 'days') d), '"누룽지"'::jsonb, '어르신 지난 날에 ② 낱말');
reset role;
update public.server_flags set enabled = false where name = 'pass_on_store_enabled';
select pg_temp.act_as('70610000-0000-0000-0000-0000000000c1', false);
select is((select p -> 'pass_ons' from jsonb_array_elements(public.child_answer_history() -> 'parents') p
            where p ->> 'parent_id' = '70610000-0000-0000-0000-00000000a001'), '[]'::jsonb, '스위치를 끄면 이미 저장된 ⑤도 자녀에게 안 나간다');
reset role;
update public.server_flags set enabled = true where name = 'pass_on_store_enabled';

-- 넘기면 지운다: ② 넘김 → ② 행과 그 값을 끼운 ⑤ recall_story도 삭제
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select public.record_session_step('recall', 1, true, 5);
reset role;
select is((select count(*)::int from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000a001')
        + (select count(*)::int from public.pass_on_picks where parent_id = '70610000-0000-0000-0000-00000000a001'), 0,
          '② 넘김 → ② 행과 recall_story ⑤ 행 삭제(넘긴 날 무표시)');
select is((pg_temp.sess('70610000-0000-0000-0000-00000000a001')).completed_at is not null, true, '이미 찍힌 도장은 그대로');
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select is(public.save_recall(1, 2), '{"ok": false, "reason": "skipped"}'::jsonb, '②를 넘긴 날은 ② 저장 거부(QA-3 M1)');
reset role;
select is((select count(*)::int from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000a001'), 0, '넘김 뒤 저장 시도 → ② 행 0(자녀 무표시)');

-- ======== (4) 지우는 길 ========
-- 그만 보여 주기
select pg_temp.act_as('70610000-0000-0000-0000-0000000000a1', true);
select public.record_session_step('recall', 1, false, 5); -- 다시 하기
select is(public.save_recall(1, 3), '{"ok": true}'::jsonb, '넘김 뒤 다시 하기로 실제로 하면 ② 저장 정상');
select is(public.save_pass_on(1, 'ask_which'), '{"ok": true}'::jsonb, '⑤ 저장(철회 전)');
select public.withdraw_consent();
reset role;
select is((select count(*)::int from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000a001')
        + (select count(*)::int from public.pass_on_picks where parent_id = '70610000-0000-0000-0000-00000000a001'), 0,
          '그만 보여 주기 → ②·⑤ 즉시 삭제');
-- 31일 파기: 31일 전 세션의 ②·⑤는 지우고 30일 전 것은 남긴다(answers·daily_sessions와 같은 기준)
insert into public.daily_sessions (family_id, parent_id, session_date, day_index) values
  ('70610000-0000-0000-0000-0000000000f1', '70610000-0000-0000-0000-00000000a002', public.kst_today() - 31, 1),
  ('70610000-0000-0000-0000-0000000000f1', '70610000-0000-0000-0000-00000000a002', public.kst_today() - 30, 2);
insert into public.recall_picks (parent_id, family_id, session_date, day_index, slot) values
  ('70610000-0000-0000-0000-00000000a002', '70610000-0000-0000-0000-0000000000f1', public.kst_today() - 31, 1, 1),
  ('70610000-0000-0000-0000-00000000a002', '70610000-0000-0000-0000-0000000000f1', public.kst_today() - 30, 2, 2);
insert into public.pass_on_picks (parent_id, family_id, session_date, day_index, line_key) values
  ('70610000-0000-0000-0000-00000000a002', '70610000-0000-0000-0000-0000000000f1', public.kst_today() - 31, 1, 'ask_which'),
  ('70610000-0000-0000-0000-00000000a002', '70610000-0000-0000-0000-0000000000f1', public.kst_today() - 30, 2, 'ask_which');
select public.purge_expired_data();
select is((select array_agg(session_date order by session_date) from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000a002'),
          array[public.kst_today() - 30], '31일 파기: 31일 지난 ② 삭제, 30일 것은 남음');
select is((select array_agg(session_date order by session_date) from public.pass_on_picks where parent_id = '70610000-0000-0000-0000-00000000a002'),
          array[public.kst_today() - 30], '31일 파기: 31일 지난 ⑤ 삭제, 30일 것은 남음');
-- 자녀 목록은 30일 창(오늘-29부터): 30일 전 행은 남아 있어도 자녀에게 안 나간다
select pg_temp.act_as('70610000-0000-0000-0000-0000000000c1', false);
select is((select p -> 'recalls' from jsonb_array_elements(public.child_answer_history() -> 'parents') p
            where p ->> 'parent_id' = '70610000-0000-0000-0000-00000000a002'), '[]'::jsonb, '자녀 목록은 최근 30일(오늘 포함)만');
select is((select p -> 'pass_ons' from jsonb_array_elements(public.child_answer_history() -> 'parents') p
            where p ->> 'parent_id' = '70610000-0000-0000-0000-00000000a002'), '[]'::jsonb, '자녀 ⑤도 최근 30일만(30일 전 행은 남아 있어도 안 나감, QA-3 L2)');
reset role;
-- 관리자 계정 삭제(웹 요청, 공통 삭제 함수)
select public.admin_delete_account('70610000-0000-0000-0000-00000000a002', '#61', 'owner');
select is((select count(*)::int from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000a002')
        + (select count(*)::int from public.pass_on_picks where parent_id = '70610000-0000-0000-0000-00000000a002'), 0,
          '계정 삭제 → ②·⑤ 함께 삭제');
-- 오늘 다시 하기(dev_reset_today, 테스터 가족): 오늘 세션과 함께 ②·⑤도
insert into public.server_flags (name, enabled) values ('dev_reset_enabled', true) on conflict (name) do update set enabled = true;
update public.families set is_test = true where id = '70610000-0000-0000-0000-0000000000f2';
insert into public.recall_picks (parent_id, family_id, session_date, day_index, slot) values
  ('70610000-0000-0000-0000-00000000b001', '70610000-0000-0000-0000-0000000000f2', public.kst_today(), 1, 1);
select pg_temp.act_as('70610000-0000-0000-0000-0000000000b1', true);
select public.dev_reset_today();
reset role;
select is((select count(*)::int from public.recall_picks where parent_id = '70610000-0000-0000-0000-00000000b001'), 0, '오늘 다시 하기 → 오늘 ② 삭제');
-- 가족 전체 삭제(마지막 자녀): 가족 어르신의 ②·⑤도
insert into public.recall_picks (parent_id, family_id, session_date, day_index, slot)
select '70610000-0000-0000-0000-00000000a004', '70610000-0000-0000-0000-0000000000f1', public.kst_today(), 1, 1;
select public.admin_delete_account('70610000-0000-0000-0000-00000000c001', '#62', 'owner');
select is((select count(*)::int from public.recall_picks where family_id = '70610000-0000-0000-0000-0000000000f1'), 0, '마지막 자녀 삭제(가족 전체) → ② 삭제');

-- ======== 권한 ========
select ok(not exists (select 1 from unnest(array['public.recall_picks', 'public.pass_on_picks', 'public.content_recall_options']) t(tbl),
                             unnest(array['anon', 'authenticated']) r(role),
                             unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) pr(priv)
                       where has_table_privilege(r.role, t.tbl, pr.priv)), '앱·anon은 새 표 세 개에 아무 권한이 없다');
select ok(not exists (select 1 from unnest(array['public.recall_picks', 'public.pass_on_picks']) t(tbl),
                             unnest(array['select', 'insert', 'update', 'delete', 'truncate']) pr(priv)
                       where has_table_privilege('service_role', t.tbl, pr.priv))
          and not has_table_privilege('service_role', 'public.content_recall_options', 'insert'), '서비스 역할도 고른 값 표를 못 읽고, 보기 표에 못 쓴다');
select ok((select bool_and(c.relrowsecurity) from pg_class c where c.oid in ('public.recall_picks'::regclass, 'public.pass_on_picks'::regclass,
                                                                          'public.content_recall_options'::regclass)), '새 표 세 개 모두 RLS 켬');
select ok(not exists (select 1 from unnest(array['public.save_recall(int,int)', 'public.save_pass_on(int,text)',
                                                 'public.record_session_step(text,int,boolean,int)']) f(fn)
                       where has_function_privilege('anon', f.fn, 'execute')), 'anon은 새 RPC를 실행하지 못한다');
select ok(not exists (select 1 from unnest(array['public.pass_on_key_ok(text)', 'public.five_steps_consent_withdrawn()', 'public.recall_pick_deleted()',
                                                 'public.content_recall_options_guard()', 'public.five_steps_skipped(uuid,text)']) f(fn),
                             unnest(array['anon', 'authenticated']) r(role)
                       where has_function_privilege(r.role, f.fn, 'execute')), '내부 함수는 앱·anon이 못 부른다');
select ok((select bool_and(proconfig = array['search_path=""']) from pg_proc
            where oid in ('public.save_recall(int,int)'::regprocedure, 'public.save_pass_on(int,text)'::regprocedure,
                          'public.record_session_step(text,int,boolean,int)'::regprocedure, 'public.five_steps_consent_withdrawn()'::regprocedure,
                          'public.recall_pick_deleted()'::regprocedure, 'public.family_child_history(uuid,uuid)'::regprocedure)),
          'definer 함수의 search_path는 빈 값으로 고정');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'record_session_step'), 1, 'record_session_step 정의는 하나(옛 2인자 판 없음 — 이름 인자 호출 모호성 없음)');
select ok(public.event_prop_ok('step', '"recall"') and public.event_prop_ok('step', '"pass_on"') and public.event_prop_ok('step', '"stop_here"')
          and not public.event_prop_ok('step', '"누룽지"') and not public.pass_on_key_ok('recall_first'),
          '이벤트 step 값에 recall·pass_on·stop_here(낱말은 거부), ⑤ 키는 라이터 확정 5키');

select * from finish();
rollback;
