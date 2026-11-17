-- 코드 리뷰(2026-11-17) 반영 테스트: redeem 멱등·재연결 코드 탈취 방지·24시간 만료·코드 5개 상한 교체·콘텐츠 번호 구멍·답변 이력 보존
begin;
select plan(15);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('81000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족K 자녀
  ('81000000-0000-0000-0000-0000000000a0', 'authenticated', 'authenticated', true),  -- 이전 폰 어르신
  ('81000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 새 폰
  ('81000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true),  -- 신규 어르신
  ('82000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 가족L 자녀(코드 상한)
  ('83000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 가족M 어르신(콘텐츠 번호·이력)
insert into public.families (id, created_by) values
  ('8f100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-0000000000c1'),
  ('8f200000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-0000000000c1'),
  ('8f300000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, course_start_date) values
  ('8b100000-0000-0000-0000-0000000000c1', '81000000-0000-0000-0000-0000000000c1', '8f100000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('8b100000-0000-0000-0000-0000000000a0', '81000000-0000-0000-0000-0000000000a0', '8f100000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today()),
  ('8b200000-0000-0000-0000-0000000000c1', '82000000-0000-0000-0000-0000000000c1', '8f200000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('8b300000-0000-0000-0000-0000000000a1', '83000000-0000-0000-0000-0000000000a1', '8f300000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today() - 2);
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('8c000000-0000-0000-0000-000000000001', 1, 'a', 'b', 'p1'),
  ('8c000000-0000-0000-0000-000000000002', 2, 'a', 'b', 'p2'),
  ('8c000000-0000-0000-0000-000000000005', 5, 'a', 'b', 'p5');
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions) values
  (1, 'u', 'c1', 'k', '{x,y}'), (2, 'u', 'c2', 'k', '{x,y}'), (5, 'u', 'c5', 'k', '{x,y}');
-- 0026부터 커서 기준: 어제 2일차를 열었으면 오늘은 구멍(3·4)을 건너뛴 5일차
update public.profiles set content_seq = 2, content_seq_date = public.kst_today() - 1 where id = '8b300000-0000-0000-0000-0000000000a1';
insert into public.invite_codes (code, family_id, created_by) values ('811111', '8f100000-0000-0000-0000-000000000001', '8b100000-0000-0000-0000-0000000000c1');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~2. 같은 기기가 같은 코드를 다시 보내도(응답 유실 후 재시도) 성공이다
select pg_temp.act_as('81000000-0000-0000-0000-0000000000a2', true);
select is((public.redeem_invite_code('811111')) ->> 'ok', 'true', '코드로 연결된다');
select is((public.redeem_invite_code('811111')) ->> 'ok', 'true', '같은 기기가 같은 코드를 다시 보내도 성공이다(used로 막히지 않는다)');

-- 3~4. 재연결 코드를 두 번 발급하면 이전 코드는 사라지고, 만료는 24시간이다
select pg_temp.act_as('81000000-0000-0000-0000-0000000000c1', false);
select public.issue_invite_code('8b100000-0000-0000-0000-0000000000a0');
select public.issue_invite_code('8b100000-0000-0000-0000-0000000000a0');
reset role;
select is((select count(*)::int from public.invite_codes where target_profile_id = '8b100000-0000-0000-0000-0000000000a0' and used_at is null), 1, '같은 어르신 대상의 활성 재연결 코드는 1개뿐이다');
select is((select count(*)::int from public.invite_codes where target_profile_id = '8b100000-0000-0000-0000-0000000000a0' and expires_at = now() + interval '24 hours'), 1, '재연결 코드는 24시간 뒤 만료된다');

-- 5~6. 재연결에 성공하면 같은 대상의 다른 미사용 코드는 즉시 무효가 된다(탈취 방지)
insert into public.invite_codes (code, family_id, created_by, target_profile_id) values
  ('822222', '8f100000-0000-0000-0000-000000000001', '8b100000-0000-0000-0000-0000000000c1', '8b100000-0000-0000-0000-0000000000a0'),
  ('833333', '8f100000-0000-0000-0000-000000000001', '8b100000-0000-0000-0000-0000000000c1', '8b100000-0000-0000-0000-0000000000a0');
select pg_temp.act_as('81000000-0000-0000-0000-0000000000a1', true);
select is((public.redeem_invite_code('822222')) ->> 'ok', 'true', '재연결 코드로 새 폰이 연결된다');
reset role;
select is((select count(*)::int from public.invite_codes where code = '833333' and expires_at < now()), 1, '같은 어르신의 다른 미사용 재연결 코드는 만료된다');

-- 7~8. 가입 번호를 여러 번 새로 받아도 막히지 않고, 살아 있는 것은 1개다(0018, 이전에는 5개 상한 교체)
select pg_temp.act_as('82000000-0000-0000-0000-0000000000c1', false);
select lives_ok($$ do $b$ begin for i in 1..6 loop perform public.issue_invite_code(); end loop; end $b$ $$, '코드를 6번 발급해도 막히지 않는다');
reset role;
select is((select count(*)::int from public.invite_codes where family_id = '8f200000-0000-0000-0000-000000000001' and used_at is null and expires_at > now()), 1, '살아 있는 가입 번호는 1개로 유지된다');

-- 9~10. 콘텐츠 번호에 구멍(1,2,5)이 있어도 존재하는 날 중에서 고른다(시작 2일 후 -> 세 번째 = 5일)
select pg_temp.act_as('83000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'day_index', '5', '번호에 구멍이 있어도 존재하는 다음 날을 고른다(커서)');
select is((public.get_today_content()) -> 'photo' ->> 'caption', 'c5', '사진이 null이 아니다');

-- 11~12. 답변 이력: 어제 한 답은 오늘의 답으로 보이지 않고, 오늘 새로 답하면 이력이 남는다
select public.save_answer('8c000000-0000-0000-0000-000000000005', 'A');
reset role;
update public.answers set session_date = public.kst_today() - 1 where parent_id = '8b300000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('83000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'answered_choice', null, '지난 회차의 답은 오늘의 답으로 돌아오지 않는다');
select public.save_answer('8c000000-0000-0000-0000-000000000005', 'B');
reset role;
select is((select count(*)::int from public.answers where parent_id = '8b300000-0000-0000-0000-0000000000a1'), 2, '회차별 답이 이력으로 남는다');

-- 13~15. 앱 복원용 값: 동의 여부, 오늘 끝낸 단계, 연속일을 서버가 돌려준다
select pg_temp.act_as('83000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'consented', 'true', '동의 여부를 돌려준다');
select public.record_session_step('photo', 30);
select is((public.get_today_content()) -> 'completed_steps', '["photo"]'::jsonb, '오늘 끝낸 단계를 돌려준다(앱 재시작 후 복원)');
select is((public.get_today_content()) ->> 'streak', '0', '연속일을 돌려준다(3단계를 모두 끝내기 전이라 0)');

select * from finish();
rollback;
