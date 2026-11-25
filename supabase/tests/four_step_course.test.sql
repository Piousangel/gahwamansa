-- 0067 테스트 (pgTAP): 오늘 코스 4단계 완료 판정(기획 v2.1 Q7). 실행: npx supabase test db
-- 보호하는 것:
--   (1) 4단계 앱(p_course_len 4): ①~④를 다 하면 완료, ⑤ 기록 없이. ② 없이는 완료 아님. 완료 시각은 한 번만(다시 하기·늦은 호출에도 그대로).
--   (2) 옛 대신 기록 빌드(#287, p_course_len 5 + ④ 뒤 pass_on 넘어감): 0061과 같은 결과. 이미 완료된 세션에 pass_on 넘어감을 보내도
--       오류 없이 completed=true, 완료 시각 그대로(두 번 보내도 같음). 같은 날 5 → 4로 바뀐 기기도 ④ 뒤 완료.
--   (3) '오늘은 여기까지': 4로 부르면 ②·④만 채워 완료(⑤ 기록 없음), 5로 부르면 0061 그대로(②·④·⑤). 여기까지 뒤 ④ 다시 하기도 완료 시각 그대로.
--   (4) 계약 표지 four_steps_supported(get_today_content·preview_content), 코스 길이 3·4·5만, 권한·search_path 그대로.
begin;
select plan(32);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외

delete from public.answers; delete from public.daily_sessions; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70670000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70670000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', true),
  ('70670000-0000-0000-0000-0000000000e9', 'authenticated', 'authenticated', true); -- 연결 전(프로필 없음)
insert into public.families (id, created_by, parent_title) values
  ('70670000-0000-0000-0000-0000000000f1', '70670000-0000-0000-0000-0000000000c1', '엄마');
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'u1', '시골집 부엌', '부엌');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('70670000-0000-0000-0000-0000000000d1', 1, '숭늉', '식혜', '무엇이 당기세요?');
insert into public.content_recall_options (day_index, slot, label) values (1, 1, '아궁이'), (1, 2, '누룽지'), (1, 3, '가마솥');
-- a1 4단계 앱 · a2 대신 기록 빌드(5) · a3 같은 날 5 → 4 · a4 여기까지(4) · a5 ② 없이 여기까지(4) · a6 여기까지(5, 회귀) · a7 ② 없이 4단계
insert into public.profiles (id, user_id, family_id, role, consented_at, content_seq, content_seq_date, created_at)
select ('70670000-0000-0000-0000-00000000' || x.k)::uuid, ('70670000-0000-0000-0000-0000000000' || x.u)::uuid,
       '70670000-0000-0000-0000-0000000000f1', x.r, case when x.r = 'parent' then now() end,
       case when x.r = 'parent' then 1 end, case when x.r = 'parent' then public.kst_today() end, '2026-11-01 00:00+00'::timestamptz + x.n * interval '1 day'
  from (values ('c001', 'c1', 'child', 0), ('a001', 'a1', 'parent', 1), ('a002', 'a2', 'parent', 2), ('a003', 'a3', 'parent', 3),
               ('a004', 'a4', 'parent', 4), ('a005', 'a5', 'parent', 5), ('a006', 'a6', 'parent', 6), ('a007', 'a7', 'parent', 7)) x(k, u, r, n);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid) to public;
create function pg_temp.sess(p uuid) returns public.daily_sessions language sql as $$
  select * from public.daily_sessions where parent_id = p and session_date = public.kst_today()
$$;
grant execute on function pg_temp.sess(uuid) to public;
-- 완료 시각을 지난 값으로 옮겨 둔다(한 트랜잭션 안 now()는 같아서, 다시 찍히면 이 값이 바뀌는 것으로 잡는다)
create function pg_temp.pin_completed(p uuid) returns void language sql as $$
  update public.daily_sessions set completed_at = '2000-01-01 00:00+00' where parent_id = p and session_date = public.kst_today() and completed_at is not null
$$;

-- ======== (1) 4단계 앱 ========
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a1');
select public.record_session_step('photo', 10, false, 4);
select public.record_session_step('recall', 10, false, 4);
select is(public.record_session_step('question', 10, false, 4) ->> 'completed', 'false', '4단계: ③까지는 완료 아님');
select is(public.record_session_step('hangul', 10, false, 4) - 'streak', jsonb_build_object('completed', true, 'steps', array['hangul', 'photo', 'question', 'recall']),
          '4단계: ①~④를 다 하면 완료(⑤ 기록 없이, 반환 모양 그대로)');
reset role;
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a001')).course_len, 4::smallint, '4단계 세션은 course_len 4');
select ok(not ('pass_on' = any((pg_temp.sess('70670000-0000-0000-0000-00000000a001')).completed_steps)), '4단계 세션에 ⑤ 기록이 없다');
select pg_temp.pin_completed('70670000-0000-0000-0000-00000000a001');
-- 다 마친 뒤 ④ 다시 하기
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a1');
select is(public.record_session_step('hangul', 20, false, 4) ->> 'completed', 'true', '다시 하기: completed=true 그대로');
-- 옛 대신 기록 빌드가 같은 세션에 pass_on 넘어감(5)을 두 번 보내도
select is(public.record_session_step('pass_on', 0, true, 5) ->> 'completed', 'true', '완료 뒤 옛 빌드의 pass_on 넘어감: 오류 없이 completed=true');
select lives_ok($$ select public.record_session_step('pass_on', 0, true, 5) $$, '완료 뒤 pass_on 넘어감 두 번째도 오류 없음(멱등)');
reset role;
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a001')).completed_at, '2000-01-01 00:00+00'::timestamptz,
          '완료 시각은 처음 한 번만(다시 하기·늦은 pass_on에도 그대로)');
select is((select count(*)::int from public.daily_sessions where parent_id = '70670000-0000-0000-0000-00000000a001'), 1, '도장(세션 행)은 하루 하나');
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a001')).skipped_steps, array['pass_on'], '늦은 pass_on은 넘어감으로만 남는다(값 없음)');

-- ② 없이 4단계(a7): 완료 아님
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a7');
select public.record_session_step('photo', 1, false, 4);
select public.record_session_step('question', 1, false, 4);
select is(public.record_session_step('hangul', 1, false, 4) ->> 'completed', 'false', '4단계는 ② 없이 완료되지 않는다');
select is(public.record_session_step('recall', 1, true, 4) ->> 'completed', 'true', '②를 넘어가도 네 단계가 차면 완료');
-- 옛 3단계 호출(기본값)은 4단계 세션을 3단계로 일찍 찍지 않는다
reset role;
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a5');
select public.record_session_step('photo', 1, false, 4);
select public.record_session_step('question', 1);
select is(public.record_session_step('hangul', 1) ->> 'completed', 'false', '옛 2인자 호출은 저장 길이(4)로 판정 — ② 없이 찍히지 않는다');
reset role;
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a005')).course_len, 4::smallint, '코스 길이는 줄지 않는다(4 → 3 호출에도 4)');

-- ======== (2) 옛 대신 기록 빌드(a2, 5) — 0061과 같은 결과 ========
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a2');
select public.record_session_step('photo', 1, false, 5);
select public.record_session_step('recall', 1, false, 5);
select public.record_session_step('question', 1, false, 5);
select is(public.record_session_step('hangul', 1, false, 5) ->> 'completed', 'false', '대신 기록 빌드(5): ④ 뒤에는 아직(0061 그대로)');
select is(public.record_session_step('pass_on', 0, true, 5) ->> 'completed', 'true', '대신 기록 빌드(5): pass_on 넘어감으로 완료(0061 그대로)');
reset role;
select pg_temp.pin_completed('70670000-0000-0000-0000-00000000a002');
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a2');
select is(public.record_session_step('pass_on', 0, true, 5) ->> 'completed', 'true', '대신 기록 다시 보내도 completed=true');
reset role;
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a002')).completed_at, '2000-01-01 00:00+00'::timestamptz, '대신 기록 다시 보내도 완료 시각 그대로');

-- 같은 날 5로 시작해 4로 마친 기기(a3, staging 테스터 폰 업데이트)
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a3');
select public.record_session_step('photo', 1, false, 5);
select public.record_session_step('recall', 1, false, 5);
select public.record_session_step('question', 1, false, 4);
select is(public.record_session_step('hangul', 1, false, 4) ->> 'completed', 'true', '같은 날 5 → 4: 4로 부른 ④ 뒤 완료(화면에 없는 ⑤를 기다리지 않음)');
reset role;

-- ======== (3) 오늘은 여기까지 ========
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a4');
select public.record_session_step('photo', 1, false, 4);
select public.record_session_step('recall', 1, false, 4);
select throws_like($$ select public.record_session_step('stop_here', 0, false, 4) $$, '%stop_before_question%', '4단계도 여기까지는 ③ 전에 거부');
select public.record_session_step('question', 1, false, 4);
select is(public.record_session_step('stop_here', 0, false, 4) ->> 'completed', 'true', '4단계: ③ 뒤 여기까지 = 완료');
reset role;
select is(array[(pg_temp.sess('70670000-0000-0000-0000-00000000a004')).completed_steps::text, (pg_temp.sess('70670000-0000-0000-0000-00000000a004')).skipped_steps::text],
          array['{hangul,photo,question,recall}', '{hangul}'], '4단계 여기까지: ④만 넘어감으로 채우고 ⑤는 기록하지 않는다');
select ok((pg_temp.sess('70670000-0000-0000-0000-00000000a004')).stopped_here, '여기까지 표지');
select pg_temp.pin_completed('70670000-0000-0000-0000-00000000a004');
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a4');
select public.record_session_step('hangul', 30, false, 4);
reset role;
select is(array[(pg_temp.sess('70670000-0000-0000-0000-00000000a004')).skipped_steps::text, (pg_temp.sess('70670000-0000-0000-0000-00000000a004')).completed_at::text],
          array['{}', '2000-01-01 00:00:00+00'], '여기까지 뒤 ④ 다시 하기: 넘어감에서 빠지고 완료 시각 그대로');

-- ② 기록이 빠진 채 여기까지(4) — 서버 방어(0061 QA-1 M1)는 4에서도
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a6');
select public.record_session_step('photo', 1, false, 5);
select public.record_session_step('recall', 1, false, 5);
select public.record_session_step('question', 1, false, 5);
select is(public.record_session_step('stop_here', 0, false, 5) ->> 'completed', 'true', '5로 부른 여기까지: 0061 그대로 완료');
reset role;
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a006')).skipped_steps, array['hangul', 'pass_on'], '5로 부른 여기까지: ④·⑤를 채운다(0061 회귀 0)');
update public.daily_sessions set completed_steps = array['photo', 'question'], skipped_steps = '{}', completed_at = null, stopped_here = false, course_len = 4
 where parent_id = '70670000-0000-0000-0000-00000000a006' and session_date = public.kst_today();
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a6');
select is(public.record_session_step('stop_here', 0, false, 4) ->> 'completed', 'true', '② 기록이 빠진 4단계 세션도 여기까지로 완료');
reset role;
select is((pg_temp.sess('70670000-0000-0000-0000-00000000a006')).skipped_steps, array['hangul', 'recall'], '빠진 ②까지 채우고 ⑤는 없다');

-- ======== (4) 계약·권한 ========
select pg_temp.act_as('70670000-0000-0000-0000-0000000000a1');
select is(public.get_today_content() ->> 'four_steps_supported', 'true', '계약 표지 four_steps_supported(get_today_content)');
select throws_like($$ select public.record_session_step('photo', 1, false, 6) $$, '%invalid_course_len%', '코스 길이는 3·4·5만');
reset role;
select pg_temp.act_as('70670000-0000-0000-0000-0000000000e9');
select is(public.preview_content() ->> 'four_steps_supported', 'true', '계약 표지 four_steps_supported(preview_content, 연결 전)');
reset role;
select ok(not has_function_privilege('anon', 'public.record_session_step(text,int,boolean,int)', 'execute')
          and has_function_privilege('authenticated', 'public.record_session_step(text,int,boolean,int)', 'execute')
          and (select proconfig = array['search_path=""'] and prosecdef from pg_proc where oid = 'public.record_session_step(text,int,boolean,int)'::regprocedure),
          'record_session_step: definer·search_path 빈 값·anon 실행 불가 그대로');

select * from finish();
rollback;
