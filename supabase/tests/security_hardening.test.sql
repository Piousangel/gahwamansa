-- 0031 테스트 (pgTAP): Supabase advisors 경고 처리. 실행: npx supabase test db
-- 보호하는 것: public의 SECURITY DEFINER 함수는 하나도 anon이 실행할 수 없다(회귀 감시),
--             RLS 정책이 부르는 helper 4개는 authenticated가 계속 실행할 수 있어 RLS가 그대로 동작한다,
--             kst_today의 search_path 고정, device_tokens 정책은 auth.uid()를 한 번만 평가((select auth.uid()))하고 내 것만 보인다.
begin;
select plan(9);

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')), 0,
          'anon이 실행할 수 있는 public SECURITY DEFINER 함수가 없다');
select ok(not has_function_privilege('public', 'public.my_profile_id()', 'execute'), 'PUBLIC에서도 helper 실행 권한을 회수했다');
select ok(has_function_privilege('authenticated', 'public.my_profile_id()', 'execute')
      and has_function_privilege('authenticated', 'public.my_family_id()', 'execute')
      and has_function_privilege('authenticated', 'public.my_role()', 'execute')
      and has_function_privilege('authenticated', 'public.my_consented()', 'execute'),
      'RLS 정책이 부르는 helper 4개는 authenticated가 실행할 수 있다');
select ok((select proconfig::text from pg_proc where oid = 'public.kst_today()'::regprocedure) like '%search_path=%',
          'kst_today의 search_path가 고정돼 있다');
select is(public.kst_today(), (now() at time zone 'Asia/Seoul')::date, 'kst_today 결과는 그대로다');
-- 0032에서 tokens_own(for all)이 tokens_read(select)로 바뀌었다(쓰기는 RPC만). initplan 형태는 그대로 유지돼야 한다.
select ok((select qual from pg_policies where tablename = 'device_tokens' and policyname = 'tokens_read') ilike '%select auth.uid()%',
          'device_tokens 읽기 정책은 (select auth.uid())로 한 번만 평가한다');

-- 동작: RLS가 그대로 걸린다(helper·정책 변경 뒤에도)
insert into auth.users (id, aud, role, is_anonymous) values
  ('70310000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70310000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false);
insert into public.families (id, created_by) values ('7031f000-0000-0000-0000-000000000001', '70310000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('7031b000-0000-0000-0000-0000000000c1', '70310000-0000-0000-0000-0000000000c1', '7031f000-0000-0000-0000-000000000001', 'child');
insert into public.device_tokens (user_id, token) values
  ('70310000-0000-0000-0000-0000000000c1', 't1'), ('70310000-0000-0000-0000-0000000000c2', 't2');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70310000-0000-0000-0000-0000000000c1', false);
select is((select array_agg(token) from public.device_tokens), array['t1'], '내 푸시 토큰만 보인다');
select is((select count(*)::int from public.families where id = '7031f000-0000-0000-0000-000000000001'), 1, 'helper를 쓰는 가족 RLS도 그대로 동작한다');
reset role;
set local role anon;
select throws_ok($$ select public.my_profile_id() $$, '42501', null, 'anon은 helper를 직접 실행하지 못한다');

select * from finish();
rollback;
