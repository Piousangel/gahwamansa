-- 0053 테스트 (pgTAP): AC-05 단계 시작 이벤트·낱말 쓰기 결과. 실행: npx supabase test db
-- 보호하는 것: course_step_started{step, day_index} 기록, result=finished 허용(skipped 그대로),
--             정한 값 밖의 step·result 거부, 글자 내용 거부, 기존 이름 그대로, anon 거부.
begin;
select plan(8);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70520000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70520000-0000-0000-0000-0000000000e1', true);
select is(public.log_event('course_step_started', '{"step": "photo", "day_index": 1}'), '{"ok": true}'::jsonb, '단계 시작(사진)');
select is(public.log_event('course_step_started', '{"step": "music"}') ->> 'reason', 'invalid_props', '정한 값 밖의 step은 거부');
select is(public.log_event('course_step_completed', '{"step": "hangul", "result": "finished", "attempt_no": 1}'), '{"ok": true}'::jsonb, '낱말 쓰기 finished');
select is(public.log_event('course_step_completed', '{"step": "hangul", "result": "skipped"}'), '{"ok": true}'::jsonb, '낱말 쓰기 skipped');
select is(public.log_event('course_step_completed', '{"step": "hangul", "result": "wrong"}') ->> 'reason', 'invalid_props', '정한 값 밖의 result는 거부');
select is(public.log_event('course_step_completed', '{"step": "hangul", "word": "엄마"}') ->> 'reason', 'invalid_props', '글자 내용(목록 밖 키)은 거부');
select is(public.log_event('push_permission_result', '{"result": "granted"}'), '{"ok": true}'::jsonb, '기존 result 값은 그대로');

reset role;
set local role anon;
select throws_ok($$ select public.log_event('course_step_started', '{"step": "photo"}') $$, '42501', null, 'anon은 기록하지 못한다');

select * from finish();
rollback;
