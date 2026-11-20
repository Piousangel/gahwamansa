-- 0059 테스트 (pgTAP): 쓰기 RPC 재시도(같은 요청 두 번) — 앱 fetch 시간 제한 대비(dev-server-notes §20). 실행: npx supabase test db
-- 보호하는 것: send_cheer는 같은 요청 id로 다시 보내면 응원이 한 번만 생기고 같은 cheer_id를 돌려준다(한도에 걸린 것처럼 보이지 않음),
--             id가 다르면 새 응원(하루 2개 한도 그대로), id 없는 옛 호출은 지금과 같다, 다른 자녀의 같은 id와 섞이지 않는다.
--             create_family는 이미 자녀 프로필이 있으면 예외 대신 같은 가족·프로필을 돌려준다(어르신이면 지금처럼 거부).
--             멱등으로 확인한 save_answer·record_session_step의 재시도 동작도 고정한다.
begin;
select plan(14);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.daily_sessions; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70590000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70590000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70590000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', false), -- 가족 만들기 재시도
  ('70590000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values ('70590000-0000-0000-0000-0000000000f1', '70590000-0000-0000-0000-0000000000c1', '엄마');
insert into public.profiles (id, user_id, family_id, role, consented_at) values
  ('70590000-0000-0000-0000-00000000c001', '70590000-0000-0000-0000-0000000000c1', '70590000-0000-0000-0000-0000000000f1', 'child', null),
  ('70590000-0000-0000-0000-00000000c002', '70590000-0000-0000-0000-0000000000c2', '70590000-0000-0000-0000-0000000000f1', 'child', null),
  ('70590000-0000-0000-0000-00000000a001', '70590000-0000-0000-0000-0000000000a1', '70590000-0000-0000-0000-0000000000f1', 'parent', now());
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values ('70590000-0000-0000-0000-00000000d0d1', 1, '가을', '봄', 'q1');

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create temp table r (k text primary key, v jsonb);
grant select, insert on r to authenticated;

-- send_cheer: 같은 요청 id 재시도
select pg_temp.act_as('70590000-0000-0000-0000-0000000000c1', false);
insert into r values ('c1', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'love_you', '70590000-0000-0000-0000-0000000000e1'));
insert into r values ('c1b', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'love_you', '70590000-0000-0000-0000-0000000000e1'));
reset role;
select ok((select v ->> 'ok' from r where k = 'c1')::boolean, '첫 응원 성공');
select is((select v from r where k = 'c1b'), (select v from r where k = 'c1'), '같은 요청 id로 다시 보내면 같은 결과(같은 cheer_id)');
select is((select count(*)::int from public.cheers where from_child = '70590000-0000-0000-0000-00000000c001'), 1, '응원은 한 번만 생긴다');

-- 다른 id는 새 응원, 한도 2개 그대로. 한도에 닿은 뒤에도 앞의 같은 id 재시도는 성공으로 보인다
select pg_temp.act_as('70590000-0000-0000-0000-0000000000c1', false);
insert into r values ('c2', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'warm_day', '70590000-0000-0000-0000-0000000000e2'));
insert into r values ('c3', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'warm_day', '70590000-0000-0000-0000-0000000000e3'));
insert into r values ('c2b', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'warm_day', '70590000-0000-0000-0000-0000000000e2'));
insert into r values ('legacy', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'warm_day'));
reset role;
select ok((select v ->> 'ok' from r where k = 'c2')::boolean, '다른 요청 id는 새 응원');
select is((select v ->> 'reason' from r where k = 'c3'), 'daily_limit', '하루 2개 한도는 그대로');
select is((select v from r where k = 'c2b'), (select v from r where k = 'c2'), '한도에 닿은 뒤에도 앞 요청의 재시도는 같은 성공 결과(daily_limit로 보이지 않음)');
select is((select v ->> 'reason' from r where k = 'legacy'), 'daily_limit', 'id 없는 옛 호출은 지금과 같다');
select is((select count(*)::int from public.cheers where from_child = '70590000-0000-0000-0000-00000000c001'), 2, '모두 합쳐 응원 2개');

-- 다른 자녀가 같은 id를 써도 섞이지 않는다
select pg_temp.act_as('70590000-0000-0000-0000-0000000000c2', false);
insert into r values ('o1', public.send_cheer('70590000-0000-0000-0000-00000000a001', 'love_you', '70590000-0000-0000-0000-0000000000e1'));
reset role;
select ok((select v ->> 'ok' from r where k = 'o1')::boolean and (select v ->> 'cheer_id' from r where k = 'o1') <> (select v ->> 'cheer_id' from r where k = 'c1'),
          '다른 자녀의 같은 요청 id는 별개 응원');

-- create_family 재시도
select pg_temp.act_as('70590000-0000-0000-0000-0000000000c3', false);
insert into r values ('f1', public.create_family());
insert into r values ('f1b', public.create_family());
reset role;
select is((select v from r where k = 'f1b'), (select v from r where k = 'f1'), 'create_family 재시도는 같은 가족·프로필을 돌려준다');
select is((select count(*)::int from public.families where created_by = '70590000-0000-0000-0000-0000000000c3'), 1, '가족은 하나만 생긴다');
select pg_temp.act_as('70590000-0000-0000-0000-0000000000a1', false); -- 어르신 프로필(익명 아님 클레임으로 흉내)
select throws_like($$ select public.create_family() $$, '%already_has_profile%', '어르신 프로필이 있으면 지금처럼 거부');
reset role;

-- 멱등 확인(코드 변경 없음): save_answer·record_session_step
select pg_temp.act_as('70590000-0000-0000-0000-0000000000a1', true);
select public.save_answer('70590000-0000-0000-0000-00000000d0d1', 'A');
select public.save_answer('70590000-0000-0000-0000-00000000d0d1', 'A');
select public.record_session_step('photo', 30);
select public.record_session_step('photo', 30);
reset role;
select is((select count(*)::int from public.answers where parent_id = '70590000-0000-0000-0000-00000000a001'), 1, 'save_answer 재시도는 같은 답 한 줄(덮어쓰기)');
select is((select completed_steps::text || '/' || duration_sec from public.daily_sessions where parent_id = '70590000-0000-0000-0000-00000000a001'), '{photo}/30',
          'record_session_step 재시도는 단계·시간이 늘지 않는다');

select * from finish();
rollback;
