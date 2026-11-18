-- 0032 테스트 (pgTAP): register_push_token·unregister_push_token. 실행: npx supabase test db
-- 보호하는 것: 가족에 연결된 사용자(어르신·자녀)만 자기 토큰을 등록, 한 토큰(=한 기기)은 마지막 등록 계정 하나에만(남의 알림 오배달 방지),
--             사용자당 최근 5개, 형식·플랫폼 검사, 테이블 직접 쓰기 불가(읽기는 본인 것만), 해제는 본인 것만, 계정·가족 삭제 시 함께 지워짐.
begin;
select plan(18);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70320000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70320000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70320000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true); -- 연결 전 기기
insert into public.families (id, created_by) values ('7032f000-0000-0000-0000-000000000001', '70320000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('7032b000-0000-0000-0000-0000000000c1', '70320000-0000-0000-0000-0000000000c1', '7032f000-0000-0000-0000-000000000001', 'child'),
  ('7032b000-0000-0000-0000-0000000000a1', '70320000-0000-0000-0000-0000000000a1', '7032f000-0000-0000-0000-000000000001', 'parent');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create function pg_temp.tok(p_n int) returns text language sql as $$ select 'fcm_' || lpad(p_n::text, 4, '0') || repeat('Ab9:-_', 25) $$;
grant execute on function pg_temp.tok(int) to public;

-- 등록
select pg_temp.act_as('70320000-0000-0000-0000-0000000000a1', true);
select is(public.register_push_token(pg_temp.tok(1)), '{"ok": true}'::jsonb, '어르신이 토큰을 등록한다');
select is(public.register_push_token(pg_temp.tok(1)), '{"ok": true}'::jsonb, '같은 토큰 재등록은 멱등');
select is((select count(*)::int from public.device_tokens), 1, '본인 토큰 1개만 보인다');
select is(public.register_push_token('short') ->> 'reason', 'invalid_token', '형식이 틀린 토큰은 거부');
select is(public.register_push_token(pg_temp.tok(2) || ' x') ->> 'reason', 'invalid_token', '공백이 든 토큰은 거부');
select is(public.register_push_token(pg_temp.tok(2), 'web') ->> 'reason', 'invalid_platform', '플랫폼은 android·ios만');
select throws_ok($$ insert into public.device_tokens (user_id, token) values ('70320000-0000-0000-0000-0000000000a1', 'direct') $$,
  '42501', null, '테이블에 직접 넣지 못한다(RPC만)');
select throws_ok($$ delete from public.device_tokens $$, '42501', null, '테이블에서 직접 지우지 못한다');

-- 같은 폰에서 다른 계정이 같은 토큰을 등록하면 이전 계정 행은 지워진다
select pg_temp.act_as('70320000-0000-0000-0000-0000000000c1', false);
select is(public.register_push_token(pg_temp.tok(1)) ->> 'ok', 'true', '자녀가 같은 토큰을 등록한다');
reset role;
select is((select array_agg(user_id::text) from public.device_tokens where token = pg_temp.tok(1)),
          array['70320000-0000-0000-0000-0000000000c1'], '한 토큰은 마지막 등록 계정 하나에만 남는다');

-- 연결 전 기기는 등록 불가
select pg_temp.act_as('70320000-0000-0000-0000-0000000000e1', true);
select is(public.register_push_token(pg_temp.tok(3)) ->> 'reason', 'no_profile', '가족에 연결되지 않은 기기는 등록하지 않는다');

-- 사용자당 최근 5개
reset role;
insert into public.device_tokens (user_id, token, updated_at)
select '70320000-0000-0000-0000-0000000000a1', pg_temp.tok(100 + n), now() - make_interval(days => n) from generate_series(1, 5) n;
select pg_temp.act_as('70320000-0000-0000-0000-0000000000a1', true);
select public.register_push_token(pg_temp.tok(9));
reset role;
select is((select count(*)::int from public.device_tokens where user_id = '70320000-0000-0000-0000-0000000000a1'), 5, '사용자당 최근 5개만 남는다');
select is((select count(*)::int from public.device_tokens where token = pg_temp.tok(105)), 0, '가장 오래된 토큰이 빠진다');

-- 해제: 본인 것만
select pg_temp.act_as('70320000-0000-0000-0000-0000000000a1', true);
select is(public.unregister_push_token(pg_temp.tok(9)), '{"ok": true, "removed": 1}'::jsonb, '본인 토큰을 해제한다');
select is(public.unregister_push_token(pg_temp.tok(1)) ->> 'removed', '0', '남의 토큰은 해제되지 않는다');

-- 계정 삭제 시 함께 지워진다
select public.delete_my_account();
reset role;
select is((select count(*)::int from public.device_tokens where user_id = '70320000-0000-0000-0000-0000000000a1'), 0, '어르신 계정 삭제 시 토큰도 지워진다');

reset role;
set local role anon;
select throws_ok($$ select public.register_push_token('x') $$, '42501', null, 'anon은 등록하지 못한다');
select throws_ok($$ select public.unregister_push_token('x') $$, '42501', null, 'anon은 해제하지 못한다');

select * from finish();
rollback;
