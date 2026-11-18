-- 0048 테스트 (pgTAP): 약관 동의 리뷰(2026-11-19-terms-consent-review) TA-M1·낮음. 실행: npx supabase test db
-- 보호하는 것: 게시된 약관·방침 버전만 동의로 받는다, 게시는 서비스 역할만(감사), my_terms_status가 최신 게시 버전과 비교해 재동의 필요 여부를 준다,
--             같은 버전 쌍은 번갈아 보내도 한 번만 기록(무한 증가 방지), 금지어는 공백·폭 없는 공백을 지운 뒤 검사, public 함수의 pg_net·동적 SQL 재발 방지.
begin;
select plan(16);
delete from public.terms_versions;

insert into auth.users (id, aud, role, is_anonymous) values ('70480000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false);
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 게시(서비스 역할만)
set local role service_role;
select is(public.admin_publish_terms_version('terms', 'v1', '출시 약관', 'ops'), '{"ok": true}'::jsonb, '약관 v1 게시');
select is(public.admin_publish_terms_version('privacy', 'v1', '출시 방침', 'ops') ->> 'ok', 'true', '방침 v1 게시');
select is(public.admin_publish_terms_version('privacy', 'v1', '중복', 'ops') ->> 'reason', 'already_published', '같은 버전은 다시 게시하지 않는다');
select is(public.admin_publish_terms_version('rules', 'v1', 'x', 'ops') ->> 'reason', 'invalid_kind', '종류는 terms·privacy만');
reset role;
select is((select count(*)::int from public.admin_audit where action = 'terms_publish'), 2, '게시마다 감사 행');

-- 동의
select pg_temp.act_as('70480000-0000-0000-0000-0000000000c1', false);
select is(public.record_terms_agreement('v9', 'v1') ->> 'reason', 'unknown_version', '게시되지 않은 버전은 받지 않는다');
select is(public.my_terms_status(), '{"latest_privacy": "v1", "latest_terms": "v1", "needs_reagree": true}'::jsonb, '기록이 없으면 동의 필요');
select is(public.record_terms_agreement('v1', 'v1'), '{"ok": true, "recorded": true}'::jsonb, '게시된 버전 동의');
select is(public.my_terms_status() ->> 'needs_reagree', 'false', '최신과 같으면 재동의 불필요');
reset role;
set local role service_role;
select public.admin_publish_terms_version('privacy', 'v2', '방침 개정', 'ops');
reset role;
select pg_temp.act_as('70480000-0000-0000-0000-0000000000c1', false);
select is(public.my_terms_status() - 'agreed_at', '{"latest_privacy": "v2", "latest_terms": "v1", "needs_reagree": true, "privacy_version": "v1", "terms_version": "v1"}'::jsonb,
          '방침이 새로 게시되면 재동의 필요');
select public.record_terms_agreement('v1', 'v2');
select is(public.record_terms_agreement('v1', 'v1') ->> 'recorded', 'false', '예전 쌍을 다시 보내도 새 기록 없음(번갈아 보내기 방지)');
select is(public.record_terms_agreement('v1', 'v2') ->> 'recorded', 'false', '같은 쌍은 한 번만');
reset role;
select is((select count(*)::int from public.terms_agreements where user_id = '70480000-0000-0000-0000-0000000000c1'), 2, '이력은 쌍마다 한 줄');

-- 금지어 정규화
select throws_ok($$ insert into public.push_copy (kind, title, body) values ('daily', '오늘', '혜 택이 왔어요') $$, '23514', null, '띄어 쓴 금지어도 거부');
select throws_ok($$ insert into public.push_copy (kind, title, body) values ('daily', '오늘', U&'쿠\200B폰') $$, '23514', null, '폭 없는 공백을 끼운 금지어도 거부');

-- 재발 방지: public 함수의 pg_net·동적 SQL
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.prokind = 'f' and p.proname not in ('push_kick', 'push_daily_kick')
                         and pg_get_functiondef(p.oid) like '%net.http_%')
      and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~* '\mexecute\M\s'),
          'public 함수에 pg_net(kick 2개 제외)·동적 SQL(execute)이 없다');

select * from finish();
rollback;
