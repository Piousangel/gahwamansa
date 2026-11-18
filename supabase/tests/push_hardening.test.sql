-- 0036 테스트 (pgTAP): 푸시 리뷰(2026-11-18-push-tokens-review) 반영. 실행: npx supabase test db
-- 보호하는 것: M1 앱 역할은 public 어느 표에도 TRUNCATE·REFERENCES·TRIGGER가 없다 / M2 연결 전 계정이 같은 토큰을 등록해도 이전 계정 행은 지워진다
--             M4 같은 날 같은 어르신은 한 번만 선점(두 번째 실행은 대상 없음) / M5·M6 '알림 받기' 시각이 있는 어르신만 대상, 끄면 지워진다
--             L2 토큰은 한 행(유일) / L3 270일 지난 토큰 파기 / L4 길이·플랫폼·null 경계, 남의 행 유지 / L9 null 설정 거부 / 실행 메모 기록.
begin;
select plan(26);

-- ---- M1 ----
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p')
              and (has_table_privilege('authenticated', c.oid, 'truncate')
                or has_table_privilege('authenticated', c.oid, 'references')
                or has_table_privilege('authenticated', c.oid, 'trigger')
                or has_table_privilege('anon', c.oid, 'truncate'))), 0,
          'public 어느 표에도 앱 역할의 TRUNCATE·REFERENCES·TRIGGER가 없다');
select ok(exists (select 1 from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
                   where n.nspname = 'public' and d.defaclobjtype = 'r' and d.defaclrole = 'postgres'::regrole
                     and not exists (select 1 from aclexplode(d.defaclacl) a
                                      where a.grantee = 'authenticated'::regrole and a.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER'))),
          '앞으로 postgres가 만들 표도 기본 권한에서 빠진다');

insert into auth.users (id, aud, role, is_anonymous) values
  ('70360000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70360000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70360000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70360000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),
  ('70360000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7036f000-0000-0000-0000-000000000001', '70360000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('7036b000-0000-0000-0000-0000000000c1', '70360000-0000-0000-0000-0000000000c1', '7036f000-0000-0000-0000-000000000001', 'child', null),
  ('7036b000-0000-0000-0000-0000000000c2', '70360000-0000-0000-0000-0000000000c2', '7036f000-0000-0000-0000-000000000001', 'child', null),
  ('7036b000-0000-0000-0000-0000000000a1', '70360000-0000-0000-0000-0000000000a1', '7036f000-0000-0000-0000-000000000001', 'parent', now()),
  ('7036b000-0000-0000-0000-0000000000a2', '70360000-0000-0000-0000-0000000000a2', '7036f000-0000-0000-0000-000000000001', 'parent', now());

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create function pg_temp.tok(p_n int) returns text language sql as $$ select 'h36_' || lpad(p_n::text, 4, '0') || repeat('Ab9:-_', 5) $$;
grant execute on function pg_temp.tok(int) to public;
create function pg_temp.at_kst(p_hhmm text) returns timestamptz language sql as $$
  select (public.kst_today()::text || ' ' || p_hhmm)::timestamp at time zone 'Asia/Seoul'
$$;
create function pg_temp.mine(p jsonb) returns text[] language sql as $$
  select coalesce(array_agg(distinct t ->> 'profile_id' order by t ->> 'profile_id'), '{}')
    from jsonb_array_elements(p -> 'targets') t where t ->> 'profile_id' like '7036b000%'
$$;

-- ---- M2·L2·L4: 토큰 등록 ----
select pg_temp.act_as('70360000-0000-0000-0000-0000000000c2', false);
select public.register_push_token(pg_temp.tok(1));
select throws_ok($$ truncate public.device_tokens $$, '42501', null, '앱 역할은 device_tokens를 TRUNCATE할 수 없다');
select pg_temp.act_as('70360000-0000-0000-0000-0000000000e1', true);
select is(public.register_push_token(pg_temp.tok(1)) ->> 'reason', 'no_profile', '연결 전 계정은 no_profile');
reset role;
select is((select count(*)::int from public.device_tokens where token = pg_temp.tok(1)), 0, '그래도 같은 토큰의 이전 계정 행은 지워진다(오배달 방지)');
select ok(exists (select 1 from pg_indexes where tablename = 'device_tokens' and indexdef like 'CREATE UNIQUE INDEX%(token)'), '토큰은 표 전체에서 유일');
select pg_temp.act_as('70360000-0000-0000-0000-0000000000c2', false);
select is(public.register_push_token(repeat('a', 4096)) ->> 'ok', 'true', '4096자 토큰은 된다');
select is(public.register_push_token(repeat('a', 4097)) ->> 'reason', 'invalid_token', '4097자는 거부');
select is(public.register_push_token(null) ->> 'reason', 'invalid_token', 'null 토큰은 거부');
select is(public.register_push_token(pg_temp.tok(2), 'ios') ->> 'ok', 'true', 'ios도 된다');
select is(public.register_push_token(pg_temp.tok(3), null) ->> 'reason', 'invalid_platform', 'null 플랫폼은 거부');
select pg_temp.act_as('70360000-0000-0000-0000-0000000000c1', false);
select is(public.unregister_push_token(pg_temp.tok(2)) ->> 'removed', '0', '남의 토큰은 해제되지 않는다');
reset role;
select is((select count(*)::int from public.device_tokens where token = pg_temp.tok(2)), 1, '남의 행은 그대로 남는다');
select ok((select bool_and(p.prosecdef and 'search_path=""' = any (p.proconfig))
             from pg_proc p where p.oid in ('public.register_push_token(text,text)'::regprocedure, 'public.unregister_push_token(text)'::regprocedure)),
          '토큰 RPC는 definer + search_path 고정');

-- ---- M5·M6: 알림 받기 시각 ----
insert into public.device_tokens (user_id, token) values
  ('70360000-0000-0000-0000-0000000000a1', pg_temp.tok(11)), ('70360000-0000-0000-0000-0000000000a2', pg_temp.tok(12));
select is(pg_temp.mine(public.push_daily_targets(pg_temp.at_kst('09:00'))), '{}'::text[], '알림 받기를 누르지 않은 어르신은 대상이 아니다');
select pg_temp.act_as('70360000-0000-0000-0000-0000000000a1', true);
select is(public.set_push_enabled(true), '{"ok": true, "enabled": true}'::jsonb, '알림 받기(N1)');
select is(public.set_push_enabled(null) ->> 'reason', 'invalid', 'null은 거부(끈 알림이 켜지지 않게)');
reset role;
select ok((select push_consented_at is not null from public.profiles where id = '7036b000-0000-0000-0000-0000000000a1'), '받기 시각이 남는다');
select is(pg_temp.mine(public.push_daily_targets(pg_temp.at_kst('09:00'))), array['7036b000-0000-0000-0000-0000000000a1'], '받기 시각이 있는 어르신만 대상');
select pg_temp.act_as('70360000-0000-0000-0000-0000000000a1', true);
select public.set_push_enabled(false);
reset role;
select is((select push_consented_at from public.profiles where id = '7036b000-0000-0000-0000-0000000000a1'), null, '끄면 받기 시각이 지워진다');
select pg_temp.act_as('70360000-0000-0000-0000-0000000000a1', true);
select public.set_push_enabled(true);
reset role;

-- ---- M4: 선점 ----
insert into public.push_copy (kind, title, body) values ('daily', '가화만사성', '오늘의 사진이 왔어요') on conflict (kind) do nothing;
select is(pg_temp.mine(public.push_daily_claim(pg_temp.at_kst('09:00'))), array['7036b000-0000-0000-0000-0000000000a1'], '첫 실행이 어르신을 선점한다');
select is(pg_temp.mine(public.push_daily_claim(pg_temp.at_kst('09:01'))), '{}'::text[], '같은 날 두 번째 실행(동시·재시도)은 같은 어르신을 다시 받지 못한다');
select is(pg_temp.mine(public.push_daily_targets(pg_temp.at_kst('10:00'))), '{}'::text[], '선점된 어르신은 미리보기 대상에서도 빠진다');
select is(public.push_record('daily', '[]'::jsonb, 0, pg_temp.at_kst('09:00'), 'config_error') ->> 'sent', '0', '설정 오류로 멈춘 실행도 메모와 함께 기록된다');
select is((select note from public.push_runs order by id desc limit 1), 'config_error', '실행 메모가 남는다');

-- ---- L3: 270일 지난 토큰 ----
insert into public.device_tokens (user_id, token, updated_at) values ('70360000-0000-0000-0000-0000000000a2', pg_temp.tok(99), now() - interval '271 days');
select public.purge_expired_data();
select is((select count(*)::int from public.device_tokens where token = pg_temp.tok(99)), 0, '270일 넘게 갱신 안 된 토큰은 파기 배치가 지운다');

select * from finish();
rollback;
