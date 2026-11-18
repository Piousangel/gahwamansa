-- 0046 테스트 (pgTAP): 약관·처리방침 동의 기록(법률 Q2) + 푸시 문구 광고성 금지어(Q6). 실행: npx supabase test db
-- 보호하는 것: 로그인한 본인만 자기 동의를 남긴다(가족 연결 전 어르신 기기·로그인 직후 자녀 포함), 버전 형식 검사, 같은 버전 반복은 이력을 늘리지 않음,
--             버전이 바뀌면 새 이력, 앱은 표를 직접 못 읽고 my_terms_status로 최신 버전만 본다, 계정을 지우면 이력도 지워진다(D-05 원칙),
--             푸시 문구·응원 문장에 광고성 낱말(혜택·할인·이벤트·무료·쿠폰 등)이 들어가면 서버가 거부한다.
begin;
select plan(15);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70460000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),  -- 자녀(가족 만들기 전)
  ('70460000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);   -- 어르신 기기(연결 전)

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70460000-0000-0000-0000-0000000000c1', false);
select is(public.record_terms_agreement('v1', 'v2'), '{"ok": true, "recorded": true}'::jsonb, '가족 만들기 전 자녀도 동의를 남긴다');
select is(public.record_terms_agreement('v1', 'v2'), '{"ok": true, "recorded": false}'::jsonb, '같은 버전 반복은 이력을 늘리지 않는다');
select is(public.record_terms_agreement('v1', 'v3') ->> 'recorded', 'true', '방침 버전이 바뀌면 새 이력');
select is(public.record_terms_agreement('2026-11-19', 'v3') ->> 'recorded', 'true', '날짜 형식 버전도 된다');
select is(public.record_terms_agreement('bad version', 'v3') ->> 'reason', 'invalid_version', '형식이 틀리면 거부');
select is(public.record_terms_agreement(null, 'v3') ->> 'reason', 'invalid_version', 'null은 거부');
select is(public.my_terms_status() - 'agreed_at', '{"privacy_version": "v3", "terms_version": "2026-11-19"}'::jsonb, '내 최신 동의 버전을 본다');
select throws_ok($$ select count(*) from public.terms_agreements $$, '42501', null, '앱은 동의 이력 표를 직접 못 읽는다');

select pg_temp.act_as('70460000-0000-0000-0000-0000000000a1', true);
select is(public.record_terms_agreement('v1', 'v2') ->> 'ok', 'true', '연결 전 어르신 기기도 동의를 남긴다');
select is(public.my_terms_status() ->> 'terms_version', 'v1', '사람마다 따로');
reset role;
select is((select array_agg(role order by role) from public.terms_agreements where user_id in ('70460000-0000-0000-0000-0000000000c1', '70460000-0000-0000-0000-0000000000a1')),
          array['none', 'none', 'none', 'none'], '가족 연결 전이면 역할은 none으로 남는다');

delete from auth.users where id = '70460000-0000-0000-0000-0000000000c1';
select is((select count(*)::int from public.terms_agreements where user_id = '70460000-0000-0000-0000-0000000000c1'), 0, '계정을 지우면 동의 이력도 지워진다');

reset role;
set local role anon;
select throws_ok($$ select public.record_terms_agreement('v1', 'v1') $$, '42501', null, 'anon은 기록하지 못한다');
reset role;

-- Q6: 광고성 금지어
select throws_ok($$ insert into public.push_copy (kind, title, body) values ('daily', '오늘의 사진', '무료 혜택이 왔어요') $$, '23514', null, '푸시 문구에 광고성 낱말이 있으면 거부');
select throws_ok($$ insert into public.cheer_texts (message_key, text) values ('love_you', '쿠폰 받으세요') $$, '23514', null, '응원 문장도 같은 검사');

select * from finish();
rollback;
