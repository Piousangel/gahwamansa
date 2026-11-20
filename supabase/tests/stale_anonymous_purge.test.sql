-- 0057 테스트 (pgTAP): 연결 전·옛 익명 계정 자동 정리(90일, DECISIONS 11-20, 방침 P21). 실행: npx supabase test db
-- 보호하는 것: 마지막 활동 89일은 남고 91일은 지워짐, 세션 갱신(앱 사용)이 있으면 남음, 연결된 어르신·익명 아닌 자녀는 대상 아님,
--             재연결로 비워진 옛 익명 계정은 지워짐, 지울 때 약관 확인 기록도 함께, 식별자 없는 account_purged 기록, 파기 배치 결과 키, 실행 권한.
begin;
select plan(21);
delete from public.events where name in ('account_purged', 'account_deleted'); delete from public.stale_purge_failures;

insert into auth.users (id, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('70570000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true,  now() - interval '91 days', now() - interval '91 days'), -- 연결 0, 91일 → 지움
  ('70570000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true,  now() - interval '89 days', now() - interval '89 days'), -- 연결 0, 89일 → 남음
  ('70570000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true,  now() - interval '120 days', now() - interval '120 days'), -- 120일 전 가입, 세션은 10일 전 갱신 → 남음
  ('70570000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', true,  now() - interval '200 days', now() - interval '200 days'), -- 연결된 어르신(프로필 있음) → 대상 아님
  ('70570000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', true,  now() - interval '100 days', now() - interval '100 days'), -- 재연결로 비워진 옛 익명 → 지움
  ('70570000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false, now() - interval '200 days', now() - interval '200 days'), -- 가족 안 만든 자녀(익명 아님) → 이번 범위 밖
  ('70570000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', true,  now() - interval '120 days', now() - interval '120 days'), -- 리프레시 토큰만 최근 → 남음
  ('70570000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', true,  now() - interval '120 days', now() - interval '120 days'), -- 세션 refreshed_at만 최근 → 남음
  ('70570000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true,  now(), now());                                            -- 1인자 경로 회귀(본인 삭제)
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values
  ('70570000-0000-0000-0000-00000000e5a3', '70570000-0000-0000-0000-0000000000a3', now() - interval '120 days', now() - interval '10 days', null),
  ('70570000-0000-0000-0000-00000000e5a7', '70570000-0000-0000-0000-0000000000a7', now() - interval '120 days', now() - interval '120 days',
   (now() - interval '3 days') at time zone 'UTC');
insert into auth.refresh_tokens (token, user_id, created_at, updated_at) values
  ('rt0057a6', '70570000-0000-0000-0000-0000000000a6', now() - interval '120 days', now() - interval '5 days');
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

select is((select count(*)::int from auth.users where id in ('70570000-0000-0000-0000-0000000000a6', '70570000-0000-0000-0000-0000000000a7')), 2,
          '리프레시 토큰만·세션 refreshed_at만 최근이어도 남는다(리뷰 L2)');

-- 1인자 경로 회귀(앱·관리자): 그대로 account_deleted, 서비스 역할 실행 불가
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
select pg_temp.act_as('70570000-0000-0000-0000-0000000000e1', true);
select public.delete_my_account();
reset role;
select is((select jsonb_agg(props) from public.events where name = 'account_deleted'), '[{"scope": "none", "role": "none"}]'::jsonb,
          '연결 전 본인 삭제(1인자 경로)는 그대로 account_deleted');
select ok(not has_function_privilege('service_role', 'public.user_delete_core(uuid)', 'execute')
      and not has_function_privilege('service_role', 'public.stale_anon_days()', 'execute'), '1인자 공통 함수·상수 함수는 서비스 역할도 못 부른다(L3)');

-- 사용자별 실패 격리(M1): a8 삭제만 실패하게 해도 a9는 지워지고, a8은 다음 실행 정렬에서 뒤로
insert into auth.users (id, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('70570000-0000-0000-0000-0000000000a8', 'authenticated', 'authenticated', true, now() - interval '99 days', now() - interval '99 days'),
  ('70570000-0000-0000-0000-0000000000a9', 'authenticated', 'authenticated', true, now() - interval '98 days', now() - interval '98 days');
insert into public.device_tokens (user_id, token) values ('70570000-0000-0000-0000-0000000000a8', 'sp57_a8_00000000000001');
create function public.t0057_fail_a8() returns trigger language plpgsql as $$
begin
  if old.user_id = '70570000-0000-0000-0000-0000000000a8' then raise exception 'injected_failure'; end if;
  return old;
end $$;
create trigger t0057_fail_a8 before delete on public.device_tokens for each row execute function public.t0057_fail_a8();
select is(public.purge_stale_anonymous(now()), '{"purged": 1, "failed": 1}'::jsonb, '한 명이 실패해도 나머지는 지우고 실패 수를 돌려준다');
select is((select array_agg(id::text order by id) from auth.users where id in ('70570000-0000-0000-0000-0000000000a8', '70570000-0000-0000-0000-0000000000a9')),
          array['70570000-0000-0000-0000-0000000000a8'], '실패한 a8만 남고 a9는 지워졌다');
select is((select failures from public.stale_purge_failures where user_id = '70570000-0000-0000-0000-0000000000a8'), 1, '실패 횟수를 남긴다');
insert into auth.users (id, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('70570000-0000-0000-0000-00000000a010', 'authenticated', 'authenticated', true, now() - interval '95 days', now() - interval '95 days');
select is((select x::text from public.stale_anonymous_users(now(), 1) x), '70570000-0000-0000-0000-00000000a010',
          '실패한 사람(더 오래된 a8)은 다음 실행에서 맨 앞을 막지 않는다');
select is((public.purge_expired_data(now()) ->> 'stale_anonymous_failed')::int, 1, '파기 배치 결과에 실패 건수가 보인다');
drop trigger t0057_fail_a8 on public.device_tokens;
select public.purge_stale_anonymous(now()); -- 트리거를 풀면 a8도 지워진다
select is(public.purge_stale_anonymous(now()), '{"purged": 0, "failed": 0}'::jsonb, '다시 돌려도 지울 것이 없다(멱등)');

-- 단계 전체 실패(-1): 다른 파기 결과는 그대로 나온다
create or replace function public.stale_anon_days() returns int language plpgsql immutable set search_path = '' as $$ begin raise exception 'injected'; end $$;
select ok((public.purge_expired_data(now()) ->> 'stale_anonymous')::int = -1 and (public.purge_expired_data(now()) ? 'answers'),
          '정리 단계 전체가 실패하면 stale_anonymous = -1, 다른 파기 결과는 유지(트랜잭션 끝에 rollback)');

select * from finish();
rollback;
