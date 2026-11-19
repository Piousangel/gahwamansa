-- 0055 테스트 (pgTAP): push_opened{push_kind} 에 0052 의 parent_first_answer 허용. 실행: npx supabase test db
-- 보호하는 것: 새 값 기록, 기존 값 그대로, 목록 밖 값 거부, 0053 규칙(result finished·course_step_started) 유지.
begin;
select plan(5);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70550000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', false);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70550000-0000-0000-0000-0000000000e1', false);
select is(public.log_event('push_opened', '{"push_kind": "parent_first_answer"}'), '{"ok": true}'::jsonb, '자녀 첫 답 알림 열기');
select is(public.log_event('push_opened', '{"push_kind": "parent_connected"}'), '{"ok": true}'::jsonb, '기존 값 그대로');
select is(public.log_event('push_opened', '{"push_kind": "first_answer"}') ->> 'reason', 'invalid_props', '목록 밖 값은 거부');
select is(public.log_event('course_step_completed', '{"step": "hangul", "result": "finished"}'), '{"ok": true}'::jsonb, '0053 result finished 유지');
select is(public.log_event('course_step_started', '{"step": "photo", "day_index": 2}'), '{"ok": true}'::jsonb, '0053 course_step_started 유지');

select * from finish();
rollback;
