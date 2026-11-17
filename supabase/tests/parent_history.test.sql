-- 0028 테스트 (pgTAP): daily_sessions 콘텐츠 기록, parent_history, 오늘 내 답. 실행: npx supabase test db
-- 보호하는 것: 그날 받은 사진·질문·낱말 id가 세션 행에 남는다(start_today·record_session_step),
--             어르신 본인은 최근 30일(이하) 기록을 최신순으로 보고, 동의 거부·철회로 답이 없는 날은 고른 것이 빠진다,
--             자녀·anon은 못 부르고 다른 어르신 기록은 섞이지 않는다, get_today_content는 오늘 내 답을 돌려준다.
begin;
select plan(17);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('7c100000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('7c100000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('7c100000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('7c1f0000-0000-0000-0000-000000000001', '7c100000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('7c1b0000-0000-0000-0000-0000000000c1', '7c100000-0000-0000-0000-0000000000c1', '7c1f0000-0000-0000-0000-000000000001', 'child', null),
  ('7c1b0000-0000-0000-0000-0000000000a1', '7c100000-0000-0000-0000-0000000000a1', '7c1f0000-0000-0000-0000-000000000001', 'parent', now()),
  ('7c1b0000-0000-0000-0000-0000000000a2', '7c100000-0000-0000-0000-0000000000a2', '7c1f0000-0000-0000-0000-000000000001', 'parent', now());
insert into public.content_photos (id, day_index, image_url, caption, keyword) values
  ('7c1d0000-0000-0000-0000-000000000001', 1, 'u1', 'c1', '나무'),
  ('7c1d0000-0000-0000-0000-000000000002', 2, 'u2', 'c2', '감');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('7c1c0000-0000-0000-0000-000000000001', 1, '봄', '가을', 'p1'),
  ('7c1c0000-0000-0000-0000-000000000002', 2, '단감', '홍시', 'p2');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- ---- 세션 행에 콘텐츠 id ----
select pg_temp.act_as('7c100000-0000-0000-0000-0000000000a1', true);
select public.start_today();
reset role;
select is((select array[photo_id, question_id, word_id]::text[] from public.daily_sessions
            where parent_id = '7c1b0000-0000-0000-0000-0000000000a1' and session_date = public.kst_today()),
          array['7c1d0000-0000-0000-0000-000000000001', '7c1c0000-0000-0000-0000-000000000001', '7c1d0000-0000-0000-0000-000000000001'],
          'start_today가 그날 사진·질문·낱말(사진 keyword) id를 남긴다');
-- 어르신2는 start_today 없이 단계 기록만 해도 채워진다
select pg_temp.act_as('7c100000-0000-0000-0000-0000000000a2', true);
select public.record_session_step('photo', 5);
reset role;
select is((select question_id::text from public.daily_sessions where parent_id = '7c1b0000-0000-0000-0000-0000000000a2' and session_date = public.kst_today()),
          '7c1c0000-0000-0000-0000-000000000001', 'record_session_step도 콘텐츠 id를 남긴다');

-- ---- 오늘 내 답 ----
select pg_temp.act_as('7c100000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'answered_choice', null, '고르기 전에는 오늘 답이 없다');
select public.save_answer('7c1c0000-0000-0000-0000-000000000001', 'B');
select is((public.get_today_content()) ->> 'answered_choice', 'B', 'get_today_content가 오늘 내 답을 돌려준다');
select is((public.get_today_content()) ->> 'answered_label', '가을', '오늘 내 답의 선택지 글자도 돌려준다');
select is((public.start_today()) ->> 'answered_choice', 'B', 'start_today도 오늘 내 답을 돌려준다');

-- ---- 지난 기록: 어제(답 없음 = 동의 거부·철회한 날), 40일 전(범위 밖) ----
reset role;
insert into public.daily_sessions (family_id, parent_id, session_date, day_index, photo_id, question_id, word_id, completed_steps, completed_at) values
  ('7c1f0000-0000-0000-0000-000000000001', '7c1b0000-0000-0000-0000-0000000000a1', public.kst_today() - 1, 2,
   '7c1d0000-0000-0000-0000-000000000002', '7c1c0000-0000-0000-0000-000000000002', '7c1d0000-0000-0000-0000-000000000002', '{photo,question,hangul}', now()),
  ('7c1f0000-0000-0000-0000-000000000001', '7c1b0000-0000-0000-0000-0000000000a1', public.kst_today() - 40, 1,
   '7c1d0000-0000-0000-0000-000000000001', '7c1c0000-0000-0000-0000-000000000001', '7c1d0000-0000-0000-0000-000000000001', '{photo}', null);

select pg_temp.act_as('7c100000-0000-0000-0000-0000000000a1', true);
select is(jsonb_array_length((public.parent_history()) -> 'days'), 2, '최근 30일 안의 날만(빈 날·범위 밖 없음)');
select is(((public.parent_history()) -> 'days' -> 0 ->> 'session_date')::date, public.kst_today(), '최신순');
select is((public.parent_history()) -> 'days' -> 0 ->> 'choice_label', '가을', '답이 있는 날은 고른 것이 보인다');
select is((public.parent_history()) -> 'days' -> 0 -> 'photo' ->> 'keyword', '나무', '그날 사진·낱말이 보인다');
select is((public.parent_history()) -> 'days' -> 1 -> 'choice_label', 'null'::jsonb, '답이 없는 날(동의 거부·철회)은 고른 것이 빠진다');
select is((public.parent_history()) -> 'days' -> 1 -> 'question' ->> 'option_b', '홍시', '그날 질문은 보인다');
select is((public.parent_history()) -> 'days' -> 1 ->> 'completed', 'true', '그날 코스를 마쳤는지');
select is(jsonb_array_length((public.parent_history(1)) -> 'days'), 1, 'p_days=1이면 오늘만');
select is(jsonb_array_length((public.parent_history(99)) -> 'days'), 2, 'p_days는 30으로 제한된다');

select pg_temp.act_as('7c100000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.parent_history() $$, '%parent_required%', '자녀는 어르신 기록을 볼 수 없다');
reset role;
set local role anon;
select throws_ok($$ select public.parent_history() $$, '42501', null, 'anon은 parent_history를 실행하지 못한다');

select * from finish();
rollback;
