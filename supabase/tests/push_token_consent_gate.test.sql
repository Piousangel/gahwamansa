-- 0062 테스트 (pgTAP): 받기 동의 전에는 푸시 토큰을 서버에 두지 않는다(QA-3 #262 리뷰 M2 개선안). 실행: npx supabase test db
-- 보호하는 것: 동의 전 등록 → 이 계정 행 0 + 같은 토큰의 다른 계정 행은 그래도 지워짐(L4) + 응답 {ok:true, stored:false}(앱 계약 유지),
--             이미 있던 이 계정 같은 토큰 행도 지워짐, 동의 후 등록 → 행 1, 철회(set_push_enabled false) → 이 계정 행 0(다른 계정 행은 그대로),
--             철회 뒤 등록도 저장 안 함, 다시 켜고 등록하면 다시 저장, 알림을 끈(push_enabled=false) 계정은 받기 시각이 남아 있어도 저장 안 함,
--             등록이 내 프로필 행을 잠근다(#264 리뷰 M1: 철회와 동시에 와도 철회한 계정에 행이 남지 않게 줄 세우기).
begin;
select plan(16);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70620000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70620000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('70620000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7062f000-0000-0000-0000-000000000001', '70620000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, push_consented_at) values
  ('7062b000-0000-0000-0000-0000000000c1', '70620000-0000-0000-0000-0000000000c1', '7062f000-0000-0000-0000-000000000001', 'child', now()),
  ('7062b000-0000-0000-0000-0000000000a1', '70620000-0000-0000-0000-0000000000a1', '7062f000-0000-0000-0000-000000000001', 'parent', null),
  ('7062b000-0000-0000-0000-0000000000a2', '70620000-0000-0000-0000-0000000000a2', '7062f000-0000-0000-0000-000000000001', 'parent', null);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create function pg_temp.tok(p_n int) returns text language sql as $$ select 'g62_' || lpad(p_n::text, 4, '0') || repeat('Ab9:-_', 5) $$;
grant execute on function pg_temp.tok(int) to public;
create function pg_temp.n(p_uid uuid) returns int language sql as $$ select count(*)::int from public.device_tokens where user_id = p_uid $$;

-- 같은 기기(tok 1)를 받기 동의한 자녀가 먼저 쓰고 있었다
select pg_temp.act_as('70620000-0000-0000-0000-0000000000c1', false);
select is(public.register_push_token(pg_temp.tok(1)), '{"ok": true, "stored": true}'::jsonb, '받기 동의한 계정은 저장된다');
select is(public.register_push_token(pg_temp.tok(2)) ->> 'stored', 'true', '자녀의 다른 기기도 저장된다');

-- 받기 동의 전 어르신이 같은 기기에서 등록
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a1', true);
select is(public.register_push_token(pg_temp.tok(1)), '{"ok": true, "stored": false}'::jsonb, '받기 동의 전 등록은 ok지만 저장하지 않는다(앱 계약 ok:true 유지)');
reset role;
select is(pg_temp.n('70620000-0000-0000-0000-0000000000a1'), 0, '동의 전 계정의 토큰 행은 0');
select is((select count(*)::int from public.device_tokens where token = pg_temp.tok(1)), 0, '같은 토큰의 다른 계정(자녀) 행은 그래도 지워진다(L4 오배달 방지)');

-- 동의 전인데 이 계정 행이 이미 있던 경우(0062 이전 등록분 등)도 지운다
insert into public.device_tokens (user_id, token) values ('70620000-0000-0000-0000-0000000000a1', pg_temp.tok(3));
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a1', true);
select is(public.register_push_token(pg_temp.tok(3)) ->> 'stored', 'false', '동의 전 재등록도 저장 안 함');
reset role;
select is(pg_temp.n('70620000-0000-0000-0000-0000000000a1'), 0, '이미 있던 이 계정 같은 토큰 행도 지워진다');

-- 받기 동의('알려 주세요') 뒤 등록 → 저장
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a1', true);
select public.set_push_enabled(true);
select is(public.register_push_token(pg_temp.tok(1)), '{"ok": true, "stored": true}'::jsonb, '받기 동의 뒤 등록은 저장된다');
reset role;
select is(pg_temp.n('70620000-0000-0000-0000-0000000000a1'), 1, '동의 후 이 계정 행 1');

-- 받기 철회 → 이 계정 토큰 행 정리, 다른 계정 행은 그대로
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a1', true);
select is(public.set_push_enabled(false), '{"ok": true, "enabled": false}'::jsonb, '철회 응답 모양은 그대로');
reset role;
select is(pg_temp.n('70620000-0000-0000-0000-0000000000a1'), 0, '철회하면 이 계정 토큰 행이 지워진다');
select is(pg_temp.n('70620000-0000-0000-0000-0000000000c1'), 1, '다른 계정(자녀 tok 2) 행은 그대로');

-- 철회 뒤 등록(앱 시작 sync 등)은 저장 안 함 / 다시 켜면 저장
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a1', true);
select is(public.register_push_token(pg_temp.tok(1)) ->> 'stored', 'false', '철회 뒤 등록은 저장 안 함');
select public.set_push_enabled(true);
select is(public.register_push_token(pg_temp.tok(1)) ->> 'stored', 'true', '다시 켠 뒤 등록(setReceive·FamilyPushRow 흐름)은 다시 저장된다');

-- 받기 시각이 있어도 알림을 끈 상태(push_enabled=false)면 발송 대상이 아니므로 저장 안 함(push_reachable과 같은 기준)
reset role;
update public.profiles set push_enabled = false, push_consented_at = now() where id = '7062b000-0000-0000-0000-0000000000a2';
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a2', true);
select is(public.register_push_token(pg_temp.tok(5)) ->> 'stored', 'false', '알림 꺼짐이면 받기 시각이 있어도 저장 안 함');
reset role;

-- M1 줄 세우기: 등록이 내 프로필 행을 for update로 잠근다. 동시 실행 자체는 pgTAP(한 연결)으로 못 돌리므로, 잠금이 걸렸는지를
--   튜플 xmax(이 트랜잭션 id로 잠김)로 확인한다. 두 연결 경합(R1·R2)은 PR #264 증거의 race 스크립트로 확인.
insert into auth.users (id, aud, role, is_anonymous) values ('70620000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true);
insert into public.profiles (id, user_id, family_id, role, push_consented_at) values
  ('7062b000-0000-0000-0000-0000000000a3', '70620000-0000-0000-0000-0000000000a3', '7062f000-0000-0000-0000-000000000001', 'parent', now());
select pg_temp.act_as('70620000-0000-0000-0000-0000000000a3', true);
select public.register_push_token(pg_temp.tok(7));
reset role;
select is((select xmax::text from public.profiles where id = '7062b000-0000-0000-0000-0000000000a3'), pg_current_xact_id()::xid::text,
          '등록은 내 프로필 행을 잠근다(철회 set_push_enabled와 줄 세우기)');

select * from finish();
rollback;
