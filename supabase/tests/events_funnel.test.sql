-- 0029 테스트 (pgTAP): 연결 퍼널 이벤트·P6 결과 값. 실행: npx supabase test db
-- 보호하는 것: link_opened·referrer_found·code_prefilled가 기록된다, source는 정한 값(app_link·referrer·manual)만,
--             번호 값·번호 형식 문자열은 어떤 키로도 못 넣는다, course_step_completed result에 matched·kept·skipped만 추가.
begin;
select plan(12);

insert into auth.users (id, aud, role, is_anonymous) values
  ('7f100000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true); -- 설치 직후 기기(프로필 없음)

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('7f100000-0000-0000-0000-0000000000e1', true);
select is(public.log_event('link_opened', '{"source": "app_link"}'), '{"ok": true}'::jsonb, 'link_opened(app_link)가 기록된다');
select is(public.log_event('referrer_found', '{}'), '{"ok": true}'::jsonb, 'referrer_found가 기록된다');
select is(public.log_event('code_prefilled', '{"source": "referrer"}'), '{"ok": true}'::jsonb, 'code_prefilled(referrer)가 기록된다');
select is(public.log_event('link_opened', '{"source": "manual"}'), '{"ok": true}'::jsonb, 'source=manual도 된다');
select is(public.log_event('link_opened', '{"source": "qr"}') ->> 'reason', 'invalid_props', '정한 값 밖의 source는 거부된다');
select is(public.log_event('code_prefilled', '{"source": "123456"}') ->> 'reason', 'invalid_props', 'source에 번호 값은 못 넣는다');
select is(public.log_event('code_prefilled', '{"code": "123456"}') ->> 'reason', 'invalid_props', '번호 키(code)는 없다');
select is(public.log_event('code_prefilled', '{"install_source": "123456"}') ->> 'reason', 'invalid_props', '유입 토큰에 숫자 6자리(번호 형식)는 못 넣는다');

select is(public.log_event('course_step_completed', '{"step": "hangul", "result": "matched"}'), '{"ok": true}'::jsonb, 'P6 결과 matched');
select is((public.log_event('course_step_completed', '{"step": "hangul", "result": "kept"}') || public.log_event('course_step_completed', '{"step": "hangul", "result": "skipped"}')),
          '{"ok": true}'::jsonb, 'P6 결과 kept·skipped');
select is(public.log_event('course_step_completed', '{"step": "hangul", "result": "typed"}') ->> 'reason', 'invalid_props', '정한 값 밖의 result는 거부된다');

reset role;
set local role anon;
select throws_ok($$ select public.log_event('link_opened', '{"source": "app_link"}') $$, '42501', null, 'anon은 기록하지 못한다');

select * from finish();
rollback;
