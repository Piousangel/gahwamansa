-- 0057 테스트 (pgTAP): 연결 전·옛 익명 계정 자동 정리(90일, DECISIONS 11-20, 방침 P21). 실행: npx supabase test db
-- 보호하는 것: 마지막 활동 89일은 남고 91일은 지워짐, 세션 갱신(앱 사용)이 있으면 남음, 연결된 어르신·익명 아닌 자녀는 대상 아님,
--             재연결로 비워진 옛 익명 계정은 지워짐, 지울 때 약관 확인 기록도 함께, 식별자 없는 account_purged 기록, 파기 배치 결과 키, 실행 권한.
begin;
select plan(11);
delete from public.events where name = 'account_purged';

insert into auth.users (id, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('70570000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true,  now() - interval '91 days', now() - interval '91 days'), -- 연결 0, 91일 → 지움
  ('70570000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true,  now() - interval '89 days', now() - interval '89 days'), -- 연결 0, 89일 → 남음
  ('70570000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true,  now() - interval '120 days', now() - interval '120 days'), -- 120일 전 가입, 세션은 10일 전 갱신 → 남음
  ('70570000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', true,  now() - interval '200 days', now() - interval '200 days'), -- 연결된 어르신(프로필 있음) → 대상 아님
  ('70570000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', true,  now() - interval '100 days', now() - interval '100 days'), -- 재연결로 비워진 옛 익명 → 지움
  ('70570000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false, now() - interval '200 days', now() - interval '200 days'); -- 가족 안 만든 자녀(익명 아님) → 이번 범위 밖
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('70570000-0000-0000-0000-00000000e5a3', '70570000-0000-0000-0000-0000000000a3', now() - interval '120 days', now() - interval '10 days');
insert into public.families (id, created_by, parent_title) values ('70570000-0000-0000-0000-0000000000f1', '70570000-0000-0000-0000-0000000000c1', '엄마');
-- 어르신 프로필은 새 기기(a4)에 묶여 있다 = a5는 재연결 뒤 남은 옛 익명 계정
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('70570000-0000-0000-0000-00000000a004', '70570000-0000-0000-0000-0000000000a4', '70570000-0000-0000-0000-0000000000f1', 'parent', now());
insert into public.terms_agreements (user_id, role, terms_version, privacy_version, agreed_at) values
  ('70570000-0000-0000-0000-0000000000a1', 'none', 'v1', 'v1', now() - interval '91 days'),
  ('70570000-0000-0000-0000-0000000000a5', 'parent', 'v1', 'v1', now() - interval '100 days');

select is((select array_agg(x::text order by x) from public.stale_anonymous_users(now(), 500) x where x::text like '70570000%'),
          array['70570000-0000-0000-0000-0000000000a1', '70570000-0000-0000-0000-0000000000a5'], '대상은 91일 연결 0 계정과 재연결로 비워진 옛 익명 계정');
select is((public.purge_expired_data(now()) ->> 'stale_anonymous')::int >= 2, true, '파기 배치(purge_expired_data)가 정리하고 개수를 돌려준다');
select is((select count(*)::int from auth.users where id in ('70570000-0000-0000-0000-0000000000a1', '70570000-0000-0000-0000-0000000000a5')), 0, '91일·옛 익명 계정이 지워졌다');
select is((select count(*)::int from auth.users where id = '70570000-0000-0000-0000-0000000000a2'), 1, '89일은 남는다(경계)');
select is((select count(*)::int from auth.users where id = '70570000-0000-0000-0000-0000000000a3'), 1, '가입은 오래됐어도 최근 앱 사용(세션 갱신)이 있으면 남는다');
select is((select count(*)::int from auth.users u join public.profiles p on p.user_id = u.id where u.id = '70570000-0000-0000-0000-0000000000a4'), 1, '연결된 어르신은 오래돼도 대상이 아니다');
select is((select count(*)::int from auth.users where id = '70570000-0000-0000-0000-0000000000c1'), 1, '익명 아닌 자녀(가족 안 만듦)는 이번 정리 범위 밖');
select is((select count(*)::int from public.terms_agreements where user_id in ('70570000-0000-0000-0000-0000000000a1', '70570000-0000-0000-0000-0000000000a5')), 0,
          '약관 확인 기록도 함께 지워진다(delete_my_account와 같은 범위)');
select is((select jsonb_agg(props) from public.events where name = 'account_purged'),
          '[{"scope": "stale_anonymous"}, {"scope": "stale_anonymous"}]'::jsonb, '지운 일은 account_purged로 1건씩(props scope만)');
select ok(not exists (select 1 from public.events where name = 'account_purged'
                       and (family_id is not null or profile_id is not null or device_key is not null or ts <> date_trunc('hour', ts))),
          '기록에 식별자 없음·시각은 시 단위');
select ok(not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r(role),
                             unnest(array['public.purge_stale_anonymous(timestamptz)', 'public.stale_anonymous_users(timestamptz,integer)', 'public.user_delete_core(uuid,text)']) f(fn)
                       where has_function_privilege(r.role, f.fn, 'execute')), '정리 함수는 앱·anon·서비스 역할이 부를 수 없다');

select * from finish();
rollback;
