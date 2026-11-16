-- get_today_content, save_answer 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 오늘의 콘텐츠를 서버가 한 번에 돌려주는 것(번호는 행 수 기준 순환),
--             같은 질문에 다시 답해도(콘텐츠 순환) 오류 없이 갱신, 동의 없는 저장 거부, 입력 검증
begin;
select plan(15);
delete from public.content_photos; delete from public.content_questions; -- 시드와 무관하게 동작(이 트랜잭션 안에서만)

insert into auth.users (id, aud, role, is_anonymous) values
  ('61000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('61000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),  -- 동의한 어르신
  ('61000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);  -- 동의 안 한 어르신
insert into public.families (id, created_by) values ('6f000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, course_start_date) values
  ('6b000000-0000-0000-0000-0000000000c1', '61000000-0000-0000-0000-0000000000c1', '6f000000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('6b000000-0000-0000-0000-0000000000a1', '61000000-0000-0000-0000-0000000000a1', '6f000000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today() - 4), -- 4일 지남, 콘텐츠 3일분 -> 2일차
  ('6b000000-0000-0000-0000-0000000000a2', '61000000-0000-0000-0000-0000000000a2', '6f000000-0000-0000-0000-000000000001', 'parent', null, public.kst_today());
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('6c000000-0000-0000-0000-000000000001', 1, 'q1a', 'q1b', 'p1'),
  ('6c000000-0000-0000-0000-000000000002', 2, 'q2a', 'q2b', 'p2'),
  ('6c000000-0000-0000-0000-000000000003', 3, 'q3a', 'q3b', 'p3');
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions) values
  (1, 'u1', 'cap1', 'k1', array['r1a', 'r1b']), (2, 'u2', 'cap2', 'k2', array['r2a', 'r2b']), (3, 'u3', 'cap3', 'k3', array['r3a', 'r3b']);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~4. 어르신의 오늘 콘텐츠: 시작 4일 후, 3일분이면 2일차. 아직 답하지 않았다.
select pg_temp.act_as('61000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'day_index', '2', '시작 4일 후 콘텐츠 3일분이면 2일차다');
select is((public.get_today_content()) -> 'photo' ->> 'caption', 'cap2', '2일차 사진 설명을 돌려준다');
select is((public.get_today_content()) -> 'question' ->> 'id', '6c000000-0000-0000-0000-000000000002', '2일차 질문 id를 돌려준다');
select is((public.get_today_content()) ->> 'answered_choice', null, '아직 답하지 않았으면 answered_choice는 null이다');
select is((public.get_today_content()) -> 'question' ->> 'prompt', 'p2', '질문 문장(prompt)을 돌려준다');
select is((public.get_today_content()) -> 'photo' -> 'recall_questions', '["r2a", "r2b"]'::jsonb, '사진 회상 질문 2개를 돌려준다');

-- 5~7. 답변 저장과 갱신(같은 질문에 다시 답해도 오류 없음)
select lives_ok($$ select public.save_answer('6c000000-0000-0000-0000-000000000002', 'A') $$, '동의한 어르신은 답을 저장할 수 있다');
select is((public.get_today_content()) ->> 'answered_choice', 'A', '저장한 답이 오늘 콘텐츠에 보인다');
select public.save_answer('6c000000-0000-0000-0000-000000000002', 'B');
select is((select choice::text || ':' || count(*)::text from public.answers where parent_id = '6b000000-0000-0000-0000-0000000000a1' group by choice), 'B:1', '같은 질문에 다시 답하면 한 건이 갱신된다(순환해도 오류 없음)');

-- 8~11. 거부: 동의 안 함, 자녀, 잘못된 선택지
select pg_temp.act_as('61000000-0000-0000-0000-0000000000a2', true);
select throws_like($$ select public.save_answer('6c000000-0000-0000-0000-000000000001', 'A') $$, '%consent_required%', '동의하지 않은 어르신은 저장할 수 없다');
select pg_temp.act_as('61000000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.save_answer('6c000000-0000-0000-0000-000000000001', 'A') $$, '%parent_required%', '자녀는 답을 저장할 수 없다');
select throws_like($$ select public.get_today_content() $$, '%parent_required%', '자녀는 오늘의 콘텐츠를 가져올 수 없다');
select pg_temp.act_as('61000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.save_answer('6c000000-0000-0000-0000-000000000001', 'C') $$, '%invalid_choice%', 'A와 B 외의 선택은 거부한다');

-- 12. 콘텐츠가 없으면 null
reset role;
delete from public.answers; delete from public.content_photos; delete from public.content_questions;
select pg_temp.act_as('61000000-0000-0000-0000-0000000000a1', true);
select is(public.get_today_content(), null::jsonb, '콘텐츠가 없으면 null이다');

-- 13. 로그인 전(anon)은 실행할 수 없다
reset role;
set local role anon;
select throws_ok($$ select public.get_today_content() $$, '42501', null, '로그인 전 사용자는 실행할 수 없다');

select * from finish();
rollback;
