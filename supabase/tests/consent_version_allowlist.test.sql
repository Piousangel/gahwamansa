-- 0069 테스트 (pgTAP): 동의 문구 허용 버전 목록(대기열 66). 실행: npx supabase test db
-- 보호하는 것: give_consent는 서버 목록(consent_versions) 안의 버전만 받는다(v999·v7·대문자·공백·null 거부, 거부 때 저장·이력 변화 없음) /
--             옛 앱의 v5는 그대로 받는다(이미 v5면 아무것도 안 함) / 게이트 parent_month_scope는 목록 안의 v6 이상만 true —
--             이미 저장된 목록 밖 값(v999)은 동의 중이어도 false, 목록 밖에서 v6으로 다시 동의하면 true /
--             목록 함수는 내부 전용, 두 함수는 security definer + search_path '' 그대로, give_consent 권한(authenticated만) 그대로.
begin;
select plan(24);

-- 목록 자체
select is(public.consent_versions(), array['v1', 'v2', 'v3', 'v4', 'v5', 'v6'], '허용 목록 = v1(옛 서버 기본값) + 앱 CONSENT_VERSION 이력 v2~v6');
select ok((select bool_and(v ~ '^v[0-9]{1,3}$') and count(*) = count(distinct v) from unnest(public.consent_versions()) v),
          '목록 항목은 모두 v<1~3자리> 형식·중복 없음(게이트의 정수 변환이 실패하지 않는다)');

insert into auth.users (id, aud, role, is_anonymous) values
  ('70690000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70690000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70690000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', true),
  ('70690000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('70690000-0000-0000-0000-0000000000f1', '70690000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, consent_version) values
  ('70690000-0000-0000-0000-00000000c001', '70690000-0000-0000-0000-0000000000c1', '70690000-0000-0000-0000-0000000000f1', 'child', null, null),
  ('70690000-0000-0000-0000-00000000a001', '70690000-0000-0000-0000-0000000000a1', '70690000-0000-0000-0000-0000000000f1', 'parent', null, null),  -- 미응답
  ('70690000-0000-0000-0000-00000000a005', '70690000-0000-0000-0000-0000000000a5', '70690000-0000-0000-0000-0000000000f1', 'parent', now() - interval '3 days', 'v5'), -- 기존 v5
  ('70690000-0000-0000-0000-00000000a999', '70690000-0000-0000-0000-0000000000a9', '70690000-0000-0000-0000-0000000000f1', 'parent', now() - interval '3 days', 'v999'); -- 0069 전에 직접 넣은 값

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid) to public;

-- ---- give_consent: 목록 밖 거부 ----
select pg_temp.act_as('70690000-0000-0000-0000-0000000000a1');
select throws_like($$ select public.give_consent('v999') $$, '%invalid_version%', 'v999(형식은 맞지만 목록 밖) 거부');
select throws_like($$ select public.give_consent('v7') $$, '%invalid_version%', 'v7(아직 목록에 없는 다음 버전) 거부');
select throws_like($$ select public.give_consent('v0') $$, '%invalid_version%', 'v0 거부');
select throws_like($$ select public.give_consent('V6') $$, '%invalid_version%', '대문자 V6 거부');
select throws_like($$ select public.give_consent(' v6') $$, '%invalid_version%', '앞 공백 v6 거부');
select throws_like($$ select public.give_consent(null) $$, '%invalid_version%', 'null 거부(0035 그대로)');
reset role;
select ok((select consented_at is null and consent_version is null from public.profiles where id = '70690000-0000-0000-0000-00000000a001')
          and not exists (select 1 from public.consent_events where parent_id = '70690000-0000-0000-0000-00000000a001'),
          '거부된 호출은 동의·버전·이력을 남기지 않는다');

-- ---- give_consent: 목록 안 통과 ----
select pg_temp.act_as('70690000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.give_consent('v6') $$, 'v6(지금 앱) 받음');
reset role;
select is((select consent_version from public.profiles where id = '70690000-0000-0000-0000-00000000a001'), 'v6', 'v6이 저장된다');
select ok(public.parent_month_scope('70690000-0000-0000-0000-00000000a001'), 'v6 동의 → 게이트 true');

-- 기존 v5 어르신: 옛 앱이 v5를 다시 보내도 그대로(새 이력 없음), 게이트 false
select pg_temp.act_as('70690000-0000-0000-0000-0000000000a5');
select lives_ok($$ select public.give_consent('v5') $$, '옛 앱의 v5 받음');
reset role;
select is((select consent_version || ':' || (consented_at < now() - interval '2 days')::text from public.profiles where id = '70690000-0000-0000-0000-00000000a005'),
          'v5:true', '이미 v5면 버전·동의 시각 그대로');
select is((select count(*)::int from public.consent_events where parent_id = '70690000-0000-0000-0000-00000000a005'), 0, '같은 버전 반복은 이력 없음');
select ok(not public.parent_month_scope('70690000-0000-0000-0000-00000000a005'), 'v5 → 게이트 false(0068 그대로)');

-- ---- 게이트: 이미 저장된 목록 밖 값 ----
select ok(not public.parent_month_scope('70690000-0000-0000-0000-00000000a999'), '저장된 v999는 동의 중이어도 게이트 false(정수로는 6 이상)');
create function pg_temp.scope_with(p_ver text) returns boolean language plpgsql as $$
begin
  update public.profiles set consent_version = p_ver where id = '70690000-0000-0000-0000-00000000a999';
  return public.parent_month_scope('70690000-0000-0000-0000-00000000a999');
end $$;
select ok(not pg_temp.scope_with('v7'), '저장된 v7(목록 밖) → 게이트 false');
select ok(not pg_temp.scope_with('v06'), '저장된 v06(목록 밖, 정수 6) → 게이트 false');
select ok(pg_temp.scope_with('v6'), '같은 행을 v6으로 바꾸면 true(위 false가 다른 까닭 때문이 아님)');
select pg_temp.scope_with('v999');

-- v999 어르신이 지금 앱으로 다시 동의하면(v6) 목록 안 값으로 바뀌고 게이트 true
select pg_temp.act_as('70690000-0000-0000-0000-0000000000a9');
select public.give_consent('v6');
reset role;
select ok((select consent_version = 'v6' from public.profiles where id = '70690000-0000-0000-0000-00000000a999')
          and public.parent_month_scope('70690000-0000-0000-0000-00000000a999'), 'v999 → v6 재동의 후 게이트 true');

-- ---- 권한·정의 관례 ----
select ok(not has_function_privilege('authenticated', 'public.consent_versions()', 'execute')
          and not has_function_privilege('anon', 'public.consent_versions()', 'execute')
          and not has_function_privilege('service_role', 'public.consent_versions()', 'execute'),
          '목록 함수는 내부 전용(앱·anon·service_role 실행 불가)');
select ok(has_function_privilege('authenticated', 'public.give_consent(text)', 'execute')
          and not has_function_privilege('anon', 'public.give_consent(text)', 'execute')
          and not has_function_privilege('authenticated', 'public.parent_month_scope(uuid)', 'execute'),
          'give_consent는 authenticated만, 게이트는 내부 전용 그대로');
select is((select array_agg(p.proname || ':' || p.prosecdef::text || ':' || array_to_string(p.proconfig, ',') order by p.proname)
             from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('give_consent', 'parent_month_scope')),
          array['give_consent:true:search_path=""', 'parent_month_scope:true:search_path=""'], '두 함수 모두 security definer + search_path 빈 값');

select * from finish();
rollback;
