-- 0026 테스트 (pgTAP): 어르신별 콘텐츠 커서, start_today, 게시 콘텐츠 수정 금지. 실행: npx supabase test db
-- 보호하는 것: "오늘" 콘텐츠는 어르신마다 저장된 커서로 정해져 콘텐츠를 추가해도 바뀌지 않는다,
--             커서는 KST 하루에 한 번만 1칸 전진(같은 날 여러 번 불러도 1회, 며칠 쉬어도 1칸 — 놓친 장 없이),
--             새 콘텐츠는 끝에 붙어 차례가 오면 나온다, 은퇴한 콘텐츠는 건너뛴다, day_index 30 상한 없음,
--             게시된 문항·사진 문구는 고칠 수 없다(과거 답의 뜻 보존). 가족·남의 커서는 서로 영향 없음.
begin;
select plan(28);
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('78000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('78000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true),
  ('78000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by) values ('78f00000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, user_id, family_id, role, consented_at, course_start_date) values
  ('78b00000-0000-0000-0000-0000000000c1', '78000000-0000-0000-0000-0000000000c1', '78f00000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('78b00000-0000-0000-0000-0000000000a1', '78000000-0000-0000-0000-0000000000a1', '78f00000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today() - 40),
  ('78b00000-0000-0000-0000-0000000000a2', '78000000-0000-0000-0000-0000000000a2', '78f00000-0000-0000-0000-000000000001', 'parent', now(), public.kst_today());
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'u1', 'c1', 'k1'), (2, 'u2', 'c2', 'k2'), (3, 'u3', 'c3', 'k3');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('78c00000-0000-0000-0000-000000000001', 1, 'a1', 'b1', 'p1'),
  ('78c00000-0000-0000-0000-000000000002', 2, 'a2', 'b2', 'p2'),
  ('78c00000-0000-0000-0000-000000000003', 3, 'a3', 'b3', 'p3');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
-- "어제 시작한 것처럼" 커서 날짜만 옮긴다(now()는 트랜잭션 안에서 고정이라 날짜를 움직일 수 없다)
create function pg_temp.set_cursor(p_profile uuid, p_seq int, p_date date) returns void language sql as $$
  update public.profiles set content_seq = p_seq, content_seq_date = p_date where id = p_profile
$$;
create function pg_temp.seq(p_profile uuid) returns int language sql as $$ select content_seq from public.profiles where id = p_profile $$;

-- ---- 처음 연결: 시작일(40일 전)과 무관하게 첫 콘텐츠부터 ----
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'day_index', '1', '처음에는 첫 콘텐츠(시작일 무관)');
reset role;
select is(pg_temp.seq('78b00000-0000-0000-0000-0000000000a1'), null, 'get_today_content는 커서를 움직이지 않는다(읽기 전용)');
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.start_today()) ->> 'day_index', '1', 'start_today가 오늘 콘텐츠를 고정한다');
select is((public.start_today()) ->> 'advanced', 'false', '같은 날 두 번째 호출은 전진하지 않는다');
select is((public.start_today()) -> 'photo' ->> 'caption', 'c1', 'start_today는 get_today_content와 같은 내용을 준다');
reset role;
select is(pg_temp.seq('78b00000-0000-0000-0000-0000000000a1'), 1, '커서가 1에 고정된다');
select is((select day_index from public.daily_sessions where parent_id = '78b00000-0000-0000-0000-0000000000a1' and session_date = public.kst_today()), 1,
          '오늘 세션 행에 본 콘텐츠 번호가 남는다');

-- ---- 다음 날: 1칸, 며칠 쉬어도 1칸 ----
select pg_temp.set_cursor('78b00000-0000-0000-0000-0000000000a1', 1, public.kst_today() - 1);
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'day_index', '2', '다음 날 예정 콘텐츠는 2(읽기만으로 미리 보임)');
select is((public.start_today()) ->> 'advanced', 'true', '다음 날 첫 호출은 전진한다');
select is((public.start_today()) ->> 'day_index', '2', '다음 날은 2');
reset role;
select pg_temp.set_cursor('78b00000-0000-0000-0000-0000000000a1', 2, public.kst_today() - 3);
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.start_today()) ->> 'day_index', '3', '사흘 쉬고 와도 1칸만 전진한다(놓친 장 없음)');

-- ---- 콘텐츠 추가 전후 오늘 불변 ----
reset role;
select pg_temp.set_cursor('78b00000-0000-0000-0000-0000000000a1', 2, public.kst_today());
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'day_index', '2', '추가 전 오늘은 2');
reset role;
insert into public.content_photos (day_index, image_url, caption, keyword) values (31, 'u31', 'c31', 'k31');
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values ('78c00000-0000-0000-0000-000000000031', 31, 'a31', 'b31', 'p31');
select pass('day_index 30 상한이 없다(31 추가)');
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.get_today_content()) ->> 'day_index', '2', '콘텐츠를 추가해도 오늘은 그대로 2');
select is((public.start_today()) ->> 'day_index', '2', '같은 날 start_today도 그대로 2');
reset role;
select pg_temp.set_cursor('78b00000-0000-0000-0000-0000000000a1', 3, public.kst_today() - 1);
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.start_today()) ->> 'day_index', '31', '새 콘텐츠는 끝에 붙어 차례가 오면 나온다');

-- ---- 끝까지 보면 처음으로, 은퇴한 콘텐츠는 건너뜀 ----
reset role;
update public.content_questions set retired_at = now() where day_index = 1;
select pg_temp.set_cursor('78b00000-0000-0000-0000-0000000000a1', 31, public.kst_today() - 1);
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select is((public.start_today()) ->> 'day_index', '2', '끝이면 처음으로 돌고, 은퇴한 1은 건너뛴다');

-- ---- 앱이 start_today를 빠뜨려도 단계 기록이 하루 1회 전진 ----
reset role;
select pg_temp.set_cursor('78b00000-0000-0000-0000-0000000000a1', 2, public.kst_today() - 1);
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a1', true);
select public.record_session_step('photo', 10);
select public.record_session_step('question', 20);
reset role;
select is(pg_temp.seq('78b00000-0000-0000-0000-0000000000a1'), 3, 'record_session_step도 하루 1회만 전진한다');

-- ---- 어르신별 독립, 권한 ----
select is(pg_temp.seq('78b00000-0000-0000-0000-0000000000a2'), null, '다른 어르신 커서는 그대로다');
select pg_temp.act_as('78000000-0000-0000-0000-0000000000a2', true);
select is((public.start_today()) ->> 'day_index', '2', '다른 어르신은 자기 커서로 시작한다(은퇴한 1 다음 첫 콘텐츠)');
select pg_temp.act_as('78000000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.start_today() $$, '%parent_required%', '자녀는 start_today를 호출할 수 없다');
select throws_ok($$ select content_seq from public.profiles $$, '42501', null, '자녀는 어르신 커서(참여 정보)를 읽지 못한다');
select throws_ok($$ select public.advance_content_cursor('78b00000-0000-0000-0000-0000000000a1') $$, '42501', null, '내부 전진 함수는 앱이 직접 부르지 못한다');
reset role;
set local role anon;
select throws_ok($$ select public.start_today() $$, '42501', null, 'anon은 start_today를 실행하지 못한다');
reset role;

-- ---- 게시된 콘텐츠 수정 금지 ----
select throws_like($$ update public.content_questions set option_a = 'x' where day_index = 2 $$, '%content_immutable%', '게시된 문항 문구는 고칠 수 없다');
select throws_like($$ update public.content_photos set caption = 'x' where day_index = 2 $$, '%content_immutable%', '게시된 사진 설명·낱말은 고칠 수 없다');
select lives_ok($$ update public.content_photos set image_url = 'https://cdn/2.jpg' where day_index = 2 $$, '사진 주소(저장 위치)는 바꿀 수 있다');
select throws_like($$ update public.content_questions set retired_at = null where day_index = 1 $$, '%content_immutable%', '은퇴를 되돌릴 수 없다');

select * from finish();
rollback;
