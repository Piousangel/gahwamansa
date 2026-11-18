-- 0034 테스트 (pgTAP): 빌드 1 이벤트 추가(C6·B1·전환 분모·푸시 열기). 실행: npx supabase test db
-- 보호하는 것: 새 이름 5개가 기록된다, 새 속성 plan(monthly·yearly·gift)·push_kind(푸시 종류 4개)는 정한 값만,
--             기존 이름·값 규칙은 그대로(로마자 문장·번호 거부), anon 거부.
begin;
select plan(11);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70340000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70340000-0000-0000-0000-0000000000e1', true);
select is(public.log_event('paid_sheet_opened', '{}'), '{"ok": true}'::jsonb, 'C6 곧 유료 시트 열기');
select is(public.log_event('paid_interest_tapped', '{"plan": "gift"}'), '{"ok": true}'::jsonb, 'C6 소식 받기(고른 안)');
select is(public.log_event('paid_interest_tapped', '{"plan": "lifetime"}') ->> 'reason', 'invalid_props', '정한 값 밖의 plan은 거부');
select is(public.log_event('photo_zoom_opened', '{"day_index": 3}'), '{"ok": true}'::jsonb, 'B1 사진 크게 보기');
select is(public.log_event('child_first_answer_viewed', '{"days_since_connect": 2}'), '{"ok": true}'::jsonb, '전환 분모: 자녀가 첫 답을 봄');
select is(public.log_event('push_opened', '{"push_kind": "daily"}'), '{"ok": true}'::jsonb, '푸시 열기(종류)');
select is(public.log_event('push_opened', '{"push_kind": "cheer_arrived"}'), '{"ok": true}'::jsonb, '응원 도착 푸시 열기');
select is(public.log_event('push_opened', '{"push_kind": "promo"}') ->> 'reason', 'invalid_props', '정한 값 밖의 push_kind는 거부');
select is(public.log_event('link_opened', '{"source": "app_link"}'), '{"ok": true}'::jsonb, '기존 이름(0029)은 그대로 기록');
select is(public.log_event('cheer_sent', '{"channel": "mom_is_sick"}') ->> 'reason', 'invalid_props', '기존 값 규칙(문장 차단)은 그대로');

reset role;
set local role anon;
select throws_ok($$ select public.log_event('push_opened', '{"push_kind": "daily"}') $$, '42501', null, 'anon은 기록하지 못한다');

select * from finish();
rollback;
