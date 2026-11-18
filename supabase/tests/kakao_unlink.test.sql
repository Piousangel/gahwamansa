-- 0042 테스트 (pgTAP): 카카오 연결 해제 큐(로드맵 SV-06). 실행: npx supabase test db
-- 보호하는 것: 카카오로 가입한 계정을 지우면(앱 본인·관리자 삭제 모두) 카카오 회원번호가 해제 큐에 들어간다(인증 계정 삭제 전에),
--             구글·이메일·익명 계정은 넣지 않는다, 선점은 시도 횟수·다음 시도 시각을 올린다(백오프), 성공·이미 해제는 행을 지운다(회원번호 보관 안 함),
--             10번 실패하면 포기 표시 후 30일 뒤 파기, 앱은 큐·함수를 못 쓴다, cron은 할 일이 있을 때만 부른다.
begin;
select plan(13);

insert into auth.users (id, aud, role, is_anonymous) values
  ('70420000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 카카오 자녀
  ('70420000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 구글 자녀
  ('70420000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', false), -- 카카오 자녀(관리자 삭제)
  ('70420000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-9001', '70420000-0000-0000-0000-0000000000c1', '{}', 'kakao'),
  ('google-9002', '70420000-0000-0000-0000-0000000000c2', '{}', 'google'),
  ('kakao-9003', '70420000-0000-0000-0000-0000000000c3', '{}', 'kakao');
insert into public.families (id, created_by) values ('7042f000-0000-0000-0000-000000000001', '70420000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role) values
  ('7042b000-0000-0000-0000-0000000000c1', '70420000-0000-0000-0000-0000000000c1', '7042f000-0000-0000-0000-000000000001', 'child'),
  ('7042b000-0000-0000-0000-0000000000c2', '70420000-0000-0000-0000-0000000000c2', '7042f000-0000-0000-0000-000000000001', 'child'),
  ('7042b000-0000-0000-0000-0000000000c3', '70420000-0000-0000-0000-0000000000c3', '7042f000-0000-0000-0000-000000000001', 'child'),
  ('7042b000-0000-0000-0000-0000000000a1', '70420000-0000-0000-0000-0000000000a1', '7042f000-0000-0000-0000-000000000001', 'parent');
delete from public.kakao_unlink_queue;

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

select pg_temp.act_as('70420000-0000-0000-0000-0000000000c1', false);
select throws_ok($$ select count(*) from public.kakao_unlink_queue $$, '42501', null, '앱은 해제 큐를 못 읽는다');
select public.delete_my_account();
select pg_temp.act_as('70420000-0000-0000-0000-0000000000c2', false);
select public.delete_my_account();
reset role;
set local role service_role;
select public.admin_delete_account('7042b000-0000-0000-0000-0000000000c3', '메일 요청', 'ops');
reset role;
select is((select array_agg(kakao_user_id order by kakao_user_id) from public.kakao_unlink_queue), array['kakao-9001', 'kakao-9003'],
          '카카오 계정만(앱 삭제·관리자 삭제 모두) 해제 큐에 들어간다');
select is((select count(*)::int from auth.identities where user_id in ('70420000-0000-0000-0000-0000000000c1', '70420000-0000-0000-0000-0000000000c3')), 0, '인증 계정·식별자는 지워진다');
select is(public.kakao_unlink_kick() ->> 'status', 'not_configured', '할 일이 있으면 함수를 부르려 한다(설정 없음)');

-- 선점(백오프)
select is(jsonb_array_length(public.kakao_unlink_claim(10)), 2, '대기 중인 것을 선점한다');
select is(jsonb_array_length(public.kakao_unlink_claim(10)), 0, '다음 시도 시각 전에는 다시 선점하지 않는다');
select is((select max(attempts) from public.kakao_unlink_queue), 1, '시도 횟수가 오른다');

-- 결과: 9001 성공, 9003 일시 실패
select is(public.kakao_unlink_record(jsonb_build_array(
  jsonb_build_object('id', (select id from public.kakao_unlink_queue where kakao_user_id = 'kakao-9001'), 'status', 'done'),
  jsonb_build_object('id', (select id from public.kakao_unlink_queue where kakao_user_id = 'kakao-9003'), 'status', 'retry', 'http', 500))),
  '{"done": 1, "retry": 1, "gave_up": 0}'::jsonb, '결과를 기록한다');
select is((select count(*)::int from public.kakao_unlink_queue where kakao_user_id = 'kakao-9001'), 0, '해제된 회원번호는 바로 지운다');

-- 10번 실패하면 포기
update public.kakao_unlink_queue set attempts = 10 where kakao_user_id = 'kakao-9003';
select public.kakao_unlink_record(jsonb_build_array(jsonb_build_object('id', (select id from public.kakao_unlink_queue where kakao_user_id = 'kakao-9003'), 'status', 'retry', 'http', 500)));
select ok((select gave_up_at is not null from public.kakao_unlink_queue where kakao_user_id = 'kakao-9003'), '10번 실패하면 포기 표시(운영자 확인)');
select is(jsonb_array_length(public.kakao_unlink_claim(10, now() + interval '1 day')), 0, '포기한 것은 다시 선점하지 않는다');
update public.kakao_unlink_queue set gave_up_at = now() - interval '31 days' where kakao_user_id = 'kakao-9003'; -- 0043부터 미래 기준 시각 거부
select public.purge_expired_data();
select is((select count(*)::int from public.kakao_unlink_queue where kakao_user_id = 'kakao-9003'), 0, '포기한 회원번호도 30일 뒤 파기');

select pg_temp.act_as('70420000-0000-0000-0000-0000000000a1', true);
select throws_ok($$ select public.kakao_unlink_claim(1) $$, '42501', null, '앱은 선점 함수를 못 부른다');

select * from finish();
rollback;
