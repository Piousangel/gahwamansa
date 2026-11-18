-- 0033 테스트 (pgTAP): 일일 푸시 대상 선정·기록·알림 끄기·cron. 실행: npx supabase test db
-- 보호하는 것: 대상은 연결·동의한 어르신, 알림 켬, 심사 가족 아님, 오늘 코스 안 마침, 오늘 아직 안 보냄, 토큰 있음.
--             발송 창 KST 08:00~20:59 밖이면 대상 없음. 문구가 없으면 copy=null(보내지 않음). 결과 기록·무효 토큰 삭제·하루 1회.
--             대상·기록 함수와 발송 기록은 서비스 역할만. 알림 끄기는 본인만. cron은 09:00 KST, 설정이 없으면 호출하지 않음.
begin;
select plan(24);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70330000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70330000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true), -- 대상
  ('70330000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true), -- 미동의
  ('70330000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true), -- 알림 끔
  ('70330000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', true), -- 오늘 마침
  ('70330000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', true), -- 토큰 없음
  ('70330000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', true), -- 심사 가족
  ('70330000-0000-0000-0000-0000000000c7', 'authenticated', 'authenticated', false);
insert into public.families (id, created_by, is_review) values
  ('7033f000-0000-0000-0000-000000000001', '70330000-0000-0000-0000-0000000000c1', false),
  ('7033f000-0000-0000-0000-000000000007', '70330000-0000-0000-0000-0000000000c7', true);
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('7033b000-0000-0000-0000-0000000000c1', '70330000-0000-0000-0000-0000000000c1', '7033f000-0000-0000-0000-000000000001', 'child', null),
  ('7033b000-0000-0000-0000-0000000000a1', '70330000-0000-0000-0000-0000000000a1', '7033f000-0000-0000-0000-000000000001', 'parent', now()),
  ('7033b000-0000-0000-0000-0000000000a2', '70330000-0000-0000-0000-0000000000a2', '7033f000-0000-0000-0000-000000000001', 'parent', null),
  ('7033b000-0000-0000-0000-0000000000a3', '70330000-0000-0000-0000-0000000000a3', '7033f000-0000-0000-0000-000000000001', 'parent', now()),
  ('7033b000-0000-0000-0000-0000000000a4', null, '7033f000-0000-0000-0000-000000000001', 'parent', now()),            -- 연결 끊김
  ('7033b000-0000-0000-0000-0000000000a5', '70330000-0000-0000-0000-0000000000a5', '7033f000-0000-0000-0000-000000000001', 'parent', now()),
  ('7033b000-0000-0000-0000-0000000000a6', '70330000-0000-0000-0000-0000000000a6', '7033f000-0000-0000-0000-000000000001', 'parent', now()),
  ('7033b000-0000-0000-0000-0000000000c7', '70330000-0000-0000-0000-0000000000c7', '7033f000-0000-0000-0000-000000000007', 'child', null),
  ('7033b000-0000-0000-0000-0000000000a7', '70330000-0000-0000-0000-0000000000a7', '7033f000-0000-0000-0000-000000000007', 'parent', now());
-- 0036부터 '알림 받기'(N1) 시각이 있어야 대상: 다른 조건만 시험하도록 모두 받기 상태로 둔다
update public.profiles set push_consented_at = now() where id::text like '7033b000%' and role = 'parent';
update public.profiles set push_enabled = false where id = '7033b000-0000-0000-0000-0000000000a3';
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps, completed_at) values
  ('7033f000-0000-0000-0000-000000000001', '7033b000-0000-0000-0000-0000000000a5', public.kst_today(), '{photo,question,hangul}', now());
insert into public.device_tokens (user_id, token) values
  ('70330000-0000-0000-0000-0000000000c1', 'tok_child_000000000001'),
  ('70330000-0000-0000-0000-0000000000a1', 'tok_a1_00000000000001'),
  ('70330000-0000-0000-0000-0000000000a1', 'tok_a1_00000000000002'),
  ('70330000-0000-0000-0000-0000000000a2', 'tok_a2_00000000000001'),
  ('70330000-0000-0000-0000-0000000000a3', 'tok_a3_00000000000001'),
  ('70330000-0000-0000-0000-0000000000a5', 'tok_a5_00000000000001'),
  ('70330000-0000-0000-0000-0000000000a7', 'tok_a7_00000000000001');

create function pg_temp.at_kst(p_hhmm text) returns timestamptz language sql as $$
  select (public.kst_today()::text || ' ' || p_hhmm)::timestamp at time zone 'Asia/Seoul'
$$;
create function pg_temp.mine(p jsonb) returns text[] language sql as $$
  select coalesce(array_agg(distinct t ->> 'profile_id' order by t ->> 'profile_id'), '{}')
    from jsonb_array_elements(p -> 'targets') t where t ->> 'profile_id' like '7033b000%'
$$;
create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- ---- 대상 선정 ----
select is(pg_temp.mine(public.push_daily_targets(pg_temp.at_kst('09:00'))), array['7033b000-0000-0000-0000-0000000000a1'],
          '대상은 연결·동의·알림 켬·심사 아님·오늘 안 마침·토큰 있는 어르신만');
select is((select count(*)::int from jsonb_array_elements(public.push_daily_targets(pg_temp.at_kst('09:00')) -> 'targets') t
            where t ->> 'profile_id' = '7033b000-0000-0000-0000-0000000000a1'), 2, '어르신의 토큰마다 한 줄');
select is(public.push_daily_targets(pg_temp.at_kst('09:00')) ->> 'window_open', 'true', '09:00 KST는 발송 창 안');
select is(public.push_daily_targets(pg_temp.at_kst('07:59')) -> 'targets', '[]'::jsonb, '08:00 전에는 대상 없음');
select is(public.push_daily_targets(pg_temp.at_kst('21:00')) -> 'targets', '[]'::jsonb, '21:00부터는 대상 없음');
select is(public.push_daily_targets(pg_temp.at_kst('20:59')) ->> 'window_open', 'true', '20:59까지는 창 안');
select ok((public.push_daily_targets(pg_temp.at_kst('09:00')) ->> 'excluded')::int >= 5, '제외 수(미동의·알림 끔·끊김·마침·토큰 없음)를 센다');
select is(public.push_daily_targets(pg_temp.at_kst('09:00')) -> 'copy', 'null'::jsonb, '확정 문구가 없으면 copy=null(보내지 않음)');
insert into public.push_copy (kind, title, body) values ('daily', '가화만사성', '오늘의 사진이 왔어요');
select is(public.push_daily_targets(pg_temp.at_kst('09:00')) -> 'copy' ->> 'body', '오늘의 사진이 왔어요', '문구가 있으면 함께 준다');
select throws_ok($$ insert into public.push_copy (kind, title, body) values ('cheer_arrived', 't', repeat('가', 61)) $$, '23514', null, '푸시 본문은 60자 이하');

-- ---- 결과 기록 ----
select is(public.push_record('daily', jsonb_build_array(
  jsonb_build_object('profile_id', '7033b000-0000-0000-0000-0000000000a1', 'token', 'tok_a1_00000000000001', 'status', 'sent'),
  jsonb_build_object('profile_id', '7033b000-0000-0000-0000-0000000000a1', 'token', 'tok_a1_00000000000002', 'status', 'invalid_token')), 5, pg_temp.at_kst('09:00')) ->> 'sent',
  '1', '결과를 기록하고 보낸 수를 돌려준다');
select is((select count(*)::int from public.device_tokens where token = 'tok_a1_00000000000002'), 0, '무효 토큰은 지워진다');
select is((select count(*)::int from public.device_tokens where token = 'tok_a1_00000000000001'), 1, '성공한 토큰은 그대로');
select is((select sent || '/' || invalid || '/' || excluded from public.push_runs order by id desc limit 1), '1/1/5', '실행 요약(보냄/무효/제외)이 남는다');
select is(pg_temp.mine(public.push_daily_targets(pg_temp.at_kst('15:00'))), '{}'::text[], '오늘 이미 보낸 어르신은 다시 대상이 아니다(하루 1회)');
select throws_like($$ select public.push_record('daily', '[{"profile_id": "7033b000-0000-0000-0000-0000000000a1", "token": "x", "status": "maybe"}]', 0) $$,
  '%invalid_status%', '알 수 없는 결과 상태는 거부');

-- ---- 알림 끄기(본인) ----
select pg_temp.act_as('70330000-0000-0000-0000-0000000000a1', true);
select is(public.set_push_enabled(false), '{"ok": true, "enabled": false}'::jsonb, '어르신이 알림을 끈다');
select is(public.my_push_settings(), '{"enabled": false}'::jsonb, '내 알림 설정을 읽는다');
select throws_ok($$ select public.push_daily_targets() $$, '42501', null, '앱은 대상 선정 함수를 못 부른다');
select throws_ok($$ select count(*) from public.push_log $$, '42501', null, '앱은 발송 기록을 못 읽는다');
select pg_temp.act_as('70330000-0000-0000-0000-0000000000e9', true);
select is(public.set_push_enabled(true) ->> 'reason', 'no_profile', '연결 전 기기는 설정 대상이 아니다');
reset role;
set local role anon;
select throws_ok($$ select public.set_push_enabled(true) $$, '42501', null, 'anon은 설정을 못 바꾼다');
reset role;

-- ---- cron ----
select is((select schedule from cron.job where jobname = 'push-daily'), '0 0 * * *', '매일 00:00 UTC(= 09:00 KST)에 돈다');
select is(public.push_daily_kick() ->> 'status', 'not_configured', '프로젝트 URL·비밀값이 없으면 함수를 부르지 않는다');

select * from finish();
rollback;
