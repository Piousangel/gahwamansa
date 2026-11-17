-- 앱 내 계정·데이터 삭제 delete_my_account 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 삭제 범위(어르신=본인 기록, 자녀=본인, 마지막 자녀=가족 전체), 다른 가족 데이터는 그대로,
--             프로필 없는 사용자 거부, 푸시 토큰 정리, 로그인 전 실행 불가
begin;
select plan(14);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions; -- 시드와 무관하게 동작(이 트랜잭션 안에서만)

insert into auth.users (id, aud, role, is_anonymous) values
  ('71000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족F 자녀1
  ('71000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 가족F 자녀2
  ('71000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 가족F 어르신
  ('72000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족H 마지막 자녀
  ('72000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 가족H 어르신
  ('73000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족G 자녀(건드리면 안 됨)
  ('73000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 가족G 어르신
  ('7f000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 프로필 없는 사용자
insert into public.families (id, created_by) values
  ('7f100000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-0000000000c1'),
  ('7f200000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-0000000000c1'),
  ('7f300000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('7b100000-0000-0000-0000-0000000000c1', '71000000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-000000000001', 'child', null),
  ('7b100000-0000-0000-0000-0000000000c2', '71000000-0000-0000-0000-0000000000c2', '7f100000-0000-0000-0000-000000000001', 'child', null),
  ('7b100000-0000-0000-0000-0000000000a1', '71000000-0000-0000-0000-0000000000a1', '7f100000-0000-0000-0000-000000000001', 'parent', now()),
  ('7b200000-0000-0000-0000-0000000000c1', '72000000-0000-0000-0000-0000000000c1', '7f200000-0000-0000-0000-000000000001', 'child', null),
  ('7b200000-0000-0000-0000-0000000000a1', '72000000-0000-0000-0000-0000000000a1', '7f200000-0000-0000-0000-000000000001', 'parent', now()),
  ('7b300000-0000-0000-0000-0000000000c1', '73000000-0000-0000-0000-0000000000c1', '7f300000-0000-0000-0000-000000000001', 'child', null),
  ('7b300000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-0000000000a1', '7f300000-0000-0000-0000-000000000001', 'parent', now());
insert into public.content_questions (id, day_index, option_a, option_b) values ('7c000000-0000-0000-0000-000000000001', 1, 'a', 'b');
-- 각 가족에 답변·세션·응원·코드·권한·푸시 토큰
insert into public.answers (family_id, parent_id, question_id, choice) values
  ('7f100000-0000-0000-0000-000000000001', '7b100000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-000000000001', 'A'),
  ('7f200000-0000-0000-0000-000000000001', '7b200000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-000000000001', 'A'),
  ('7f300000-0000-0000-0000-000000000001', '7b300000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-000000000001', 'B');
insert into public.daily_sessions (family_id, parent_id, session_date, completed_steps, completed_at) values
  ('7f100000-0000-0000-0000-000000000001', '7b100000-0000-0000-0000-0000000000a1', public.kst_today(), '{photo,question,hangul}', now()),
  ('7f200000-0000-0000-0000-000000000001', '7b200000-0000-0000-0000-0000000000a1', public.kst_today(), '{photo,question,hangul}', now()),
  ('7f300000-0000-0000-0000-000000000001', '7b300000-0000-0000-0000-0000000000a1', public.kst_today(), '{photo,question,hangul}', now());
insert into public.cheers (family_id, from_child, to_parent, message_key) values
  ('7f100000-0000-0000-0000-000000000001', '7b100000-0000-0000-0000-0000000000c1', '7b100000-0000-0000-0000-0000000000a1', 'well_done'),
  ('7f200000-0000-0000-0000-000000000001', '7b200000-0000-0000-0000-0000000000c1', '7b200000-0000-0000-0000-0000000000a1', 'well_done'),
  ('7f300000-0000-0000-0000-000000000001', '7b300000-0000-0000-0000-0000000000c1', '7b300000-0000-0000-0000-0000000000a1', 'well_done');
insert into public.invite_codes (code, family_id, created_by, target_profile_id) values
  ('710001', '7f100000-0000-0000-0000-000000000001', '7b100000-0000-0000-0000-0000000000c1', null),
  ('710002', '7f100000-0000-0000-0000-000000000001', '7b100000-0000-0000-0000-0000000000c2', '7b100000-0000-0000-0000-0000000000a1'),
  ('720001', '7f200000-0000-0000-0000-000000000001', '7b200000-0000-0000-0000-0000000000c1', null),
  ('730001', '7f300000-0000-0000-0000-000000000001', '7b300000-0000-0000-0000-0000000000c1', null);
insert into public.entitlements (family_id, plan_id, source) values
  ('7f100000-0000-0000-0000-000000000001', 'premium', 'free_period'),
  ('7f200000-0000-0000-0000-000000000001', 'premium', 'free_period'),
  ('7f300000-0000-0000-0000-000000000001', 'premium', 'free_period');
insert into public.device_tokens (user_id, token) values
  ('72000000-0000-0000-0000-0000000000c1', 'tok-h-child'),
  ('73000000-0000-0000-0000-0000000000c1', 'tok-g-child');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~4. 자녀1 삭제(다른 자녀2가 있음): 본인 것만 지워지고 가족·어르신은 그대로
select pg_temp.act_as('71000000-0000-0000-0000-0000000000c1', false);
select is((public.delete_my_account()) ->> 'scope', 'child', '다른 자녀가 있으면 본인만 삭제된다');
reset role;
select is((select count(*)::int from public.profiles where id = '7b100000-0000-0000-0000-0000000000c1')
        + (select count(*)::int from public.cheers where from_child = '7b100000-0000-0000-0000-0000000000c1')
        + (select count(*)::int from public.invite_codes where created_by = '7b100000-0000-0000-0000-0000000000c1'), 0, '자녀1의 프로필·보낸 응원·발급한 코드가 지워진다');
select is((select count(*)::int from public.profiles where family_id = '7f100000-0000-0000-0000-000000000001'), 2, '가족F에는 자녀2와 어르신이 남는다');
select is((select count(*)::int from public.answers where family_id = '7f100000-0000-0000-0000-000000000001'), 1, '어르신 답변은 그대로다');

-- 5~7. 어르신 삭제: 본인 기록만 지워지고 가족은 그대로
select pg_temp.act_as('71000000-0000-0000-0000-0000000000a1', true);
select is((public.delete_my_account()) ->> 'scope', 'parent', '어르신은 본인 기록만 삭제된다');
reset role;
select is((select count(*)::int from public.answers where parent_id = '7b100000-0000-0000-0000-0000000000a1')
        + (select count(*)::int from public.daily_sessions where parent_id = '7b100000-0000-0000-0000-0000000000a1')
        + (select count(*)::int from public.invite_codes where target_profile_id = '7b100000-0000-0000-0000-0000000000a1'), 0, '어르신의 답변·세션·재연결 코드가 지워진다');
select is((select count(*)::int from public.profiles where family_id = '7f100000-0000-0000-0000-000000000001'), 1, '가족F에는 자녀2만 남는다');

-- 8~10. 마지막 자녀 삭제: 가족 전체(어르신 기록 포함)가 지워지고 다른 가족은 그대로
select pg_temp.act_as('72000000-0000-0000-0000-0000000000c1', false);
select is((public.delete_my_account()) ->> 'scope', 'family', '마지막 자녀가 삭제하면 가족 전체가 삭제된다');
reset role;
select is((select count(*)::int from public.families where id = '7f200000-0000-0000-0000-000000000001')
        + (select count(*)::int from public.profiles where family_id = '7f200000-0000-0000-0000-000000000001')
        + (select count(*)::int from public.answers where family_id = '7f200000-0000-0000-0000-000000000001')
        + (select count(*)::int from public.entitlements where family_id = '7f200000-0000-0000-0000-000000000001'), 0, '가족H의 가족·프로필·답변·권한이 모두 지워진다');
select is((select count(*)::int from public.profiles where family_id = '7f300000-0000-0000-0000-000000000001')
        + (select count(*)::int from public.answers where family_id = '7f300000-0000-0000-0000-000000000001')
        + (select count(*)::int from public.entitlements where family_id = '7f300000-0000-0000-0000-000000000001')
        + (select count(*)::int from public.cheers where family_id = '7f300000-0000-0000-0000-000000000001'), 5, '다른 가족G의 데이터는 그대로다(프로필 2 + 답변 1 + 권한 1 + 응원 1)');

-- 11. 프로필이 없는 사용자는 거부
select pg_temp.act_as('7f000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.delete_my_account() $$, '%no_profile%', '프로필이 없으면 삭제할 것이 없다');

-- 12. 푸시 토큰: 삭제한 사용자의 것만 지워진다
reset role;
select is((select string_agg(token, ',' order by token) from public.device_tokens), 'tok-g-child', '삭제한 사용자의 푸시 토큰은 지워지고 다른 사용자 것은 남는다');

-- 14. 코드를 사용한 인증 사용자도 삭제할 수 있다(리뷰 지적: 외래키가 계정 삭제를 막던 문제)
insert into public.invite_codes (code, family_id, created_by, used_at, used_by) values
  ('730002', '7f300000-0000-0000-0000-000000000001', '7b300000-0000-0000-0000-0000000000c1', now(), '73000000-0000-0000-0000-0000000000a1');
select lives_ok($$ delete from auth.users where id = '73000000-0000-0000-0000-0000000000a1' $$, '코드를 사용한 사용자 계정도 삭제할 수 있다');

-- 13. 로그인 전(anon)은 실행할 수 없다
set local role anon;
select throws_ok($$ select public.delete_my_account() $$, '42501', null, '로그인 전 사용자는 실행할 수 없다');

select * from finish();
rollback;
