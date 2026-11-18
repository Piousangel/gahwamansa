-- 0050 테스트 (pgTAP): parent_preview_child_view(어르신 P13 '가족에게 이렇게 보여요', PR #11 리뷰 M1). 실행: npx supabase test db
-- 보호하는 것: 어르신이 보는 미리보기는 자녀가 child_summary·child_answer_history에서 받는 것과 **같은 값**(같은 내부 함수)이다.
--             최근 답(latest)은 기간 제한이 없고(30일보다 오래돼도 보임), 지난 답 목록은 30일. 동의 안 함·철회는 자녀와 똑같이 shared=false·빈 값.
--             본인 항목만(같은 가족의 다른 어르신·다른 가족은 안 보임), 자녀 계정 정보 없음, 어르신만 실행(자녀·anon 불가).
begin;
select plan(18);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous, email) values
  ('70500000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false, 'child1-7050@example.com'),
  ('70500000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false, 'child2-7050@example.com'),
  ('70500000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true, null),
  ('70500000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', true, null),
  ('70500000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', true, null),
  ('70500000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', true, null),
  ('70500000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', true, null); -- 프로필 없음
insert into public.families (id, created_by, parent_title) values
  ('70500000-0000-0000-0000-0000000000f1', '70500000-0000-0000-0000-0000000000c1', '엄마'),
  ('70500000-0000-0000-0000-0000000000f2', '70500000-0000-0000-0000-0000000000c2', '어머니');
insert into public.profiles (id, user_id, family_id, role, consented_at, created_at, parent_title) values
  ('70500000-0000-0000-0000-00000000c001', '70500000-0000-0000-0000-0000000000c1', '70500000-0000-0000-0000-0000000000f1', 'child', null, now() - interval '60 days', null),
  ('70500000-0000-0000-0000-00000000c002', '70500000-0000-0000-0000-0000000000c2', '70500000-0000-0000-0000-0000000000f2', 'child', null, now() - interval '60 days', null),
  ('70500000-0000-0000-0000-00000000a001', '70500000-0000-0000-0000-0000000000a1', '70500000-0000-0000-0000-0000000000f1', 'parent', now(), now() - interval '50 days', null),   -- 답이 40일 전뿐
  ('70500000-0000-0000-0000-00000000a002', '70500000-0000-0000-0000-0000000000a2', '70500000-0000-0000-0000-0000000000f1', 'parent', now(), now() - interval '40 days', '아빠'), -- 최근 답
  ('70500000-0000-0000-0000-00000000a003', '70500000-0000-0000-0000-0000000000a3', '70500000-0000-0000-0000-0000000000f1', 'parent', null, now() - interval '30 days', null),  -- 동의 안 함
  ('70500000-0000-0000-0000-00000000b001', '70500000-0000-0000-0000-0000000000b1', '70500000-0000-0000-0000-0000000000f2', 'parent', now(), now() - interval '20 days', null);  -- 다른 가족
insert into public.content_questions (id, day_index, option_a, option_b, prompt, starter_a, starter_b) values
  ('70500000-0000-0000-0000-0000000000d1', 1, '가을', '봄', '어느 계절이 좋으세요?', '가을 이야기', '봄 이야기'),
  ('70500000-0000-0000-0000-0000000000d2', 2, '바다', '산', '어디로 가고 싶으세요?', '바다 이야기', '산 이야기');
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('70500000-0000-0000-0000-0000000000f1', '70500000-0000-0000-0000-00000000a001', '70500000-0000-0000-0000-0000000000d1', 'A', public.kst_today() - 40),
  ('70500000-0000-0000-0000-0000000000f1', '70500000-0000-0000-0000-00000000a002', '70500000-0000-0000-0000-0000000000d1', 'B', public.kst_today() - 1),
  ('70500000-0000-0000-0000-0000000000f1', '70500000-0000-0000-0000-00000000a002', '70500000-0000-0000-0000-0000000000d2', 'A', public.kst_today()),
  ('70500000-0000-0000-0000-0000000000f1', '70500000-0000-0000-0000-00000000a003', '70500000-0000-0000-0000-0000000000d2', 'A', public.kst_today()), -- 있더라도 보이면 안 됨
  ('70500000-0000-0000-0000-0000000000f2', '70500000-0000-0000-0000-00000000b001', '70500000-0000-0000-0000-0000000000d2', 'B', public.kst_today());

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
create temp table r (k text primary key, v jsonb);
grant select, insert, update on r to authenticated;
-- 자녀 쪽 항목만 골라 미리보기 모양({summary:{parent_title, parents:[나]}, history:{parents:[나]}})으로 만든다
create function pg_temp.child_entry(p_parent text) returns jsonb language sql as $$
  select jsonb_build_object(
    'summary', jsonb_build_object('parent_title', (select v from r where k = 'cs') -> 'parent_title',
                                  'parents', (select coalesce(jsonb_agg(e), '[]') from jsonb_array_elements((select v from r where k = 'cs') -> 'parents') e where e ->> 'parent_id' = p_parent)),
    'history', jsonb_build_object(
                                  'parents', (select coalesce(jsonb_agg(e), '[]') from jsonb_array_elements((select v from r where k = 'ch') -> 'parents') e where e ->> 'parent_id' = p_parent)))
$$;

-- 자녀가 받는 값
select pg_temp.act_as('70500000-0000-0000-0000-0000000000c1', false);
insert into r values ('cs', public.child_summary()), ('ch', public.child_answer_history());
-- 어르신 셋의 미리보기
select pg_temp.act_as('70500000-0000-0000-0000-0000000000a1', true);
insert into r values ('p1', public.parent_preview_child_view());
select pg_temp.act_as('70500000-0000-0000-0000-0000000000a2', true);
insert into r values ('p2', public.parent_preview_child_view());
select pg_temp.act_as('70500000-0000-0000-0000-0000000000a3', true);
insert into r values ('p3', public.parent_preview_child_view());
select pg_temp.act_as('70500000-0000-0000-0000-0000000000b1', true);
insert into r values ('pb', public.parent_preview_child_view());
reset role;

select is((select v from r where k = 'p1'), pg_temp.child_entry('70500000-0000-0000-0000-00000000a001'), '어르신1 미리보기 = 자녀 화면의 어르신1 항목(요약·지난 답)');
select is((select v from r where k = 'p2'), pg_temp.child_entry('70500000-0000-0000-0000-00000000a002'), '어르신2 미리보기 = 자녀 화면의 어르신2 항목');
select is((select v from r where k = 'p3'), pg_temp.child_entry('70500000-0000-0000-0000-00000000a003'), '동의 안 한 어르신 미리보기 = 자녀 화면 항목');
select is((select v from r where k = 'p1') #>> '{summary,parents,0,latest,answered_date}', (public.kst_today() - 40)::text,
          '최근 답은 기간 제한 없음: 40일 전 답도 보인다(자녀 child_summary.latest와 같음)');
select is(jsonb_array_length((select v from r where k = 'p1') #> '{history,parents,0,answers}'), 0, '지난 답 목록은 30일: 40일 전 답은 없다');
select is((select v from r where k = 'p2') #>> '{history,parents,0,answers,0,prompt_short}', '바다와 산 중', 'C5 줄은 서버 prompt_short 그대로');
select is((select v from r where k = 'p2') #>> '{summary,parents,0,latest,starter}', '바다 이야기', '고른 쪽 첫마디(starter)도 자녀와 같다');
select is((select v from r where k = 'p2') #>> '{summary,parents,0,title}', '아빠', '어르신별 호칭');
select ok(((select v from r where k = 'p3') #>> '{summary,parents,0,shared}')::boolean = false
      and (select v from r where k = 'p3') #> '{summary,parents,0,latest}' = 'null'::jsonb
      and jsonb_array_length((select v from r where k = 'p3') #> '{history,parents,0,answers}') = 0, '동의 안 함: shared=false, 최근 답 없음, 지난 답 0개');
select ok(jsonb_array_length((select v from r where k = 'p2') #> '{summary,parents}') = 1
      and jsonb_array_length((select v from r where k = 'p2') #> '{history,parents}') = 1, '본인 항목만(같은 가족의 다른 어르신은 안 보임)');
select ok((select v from r where k = 'pb')::text not like '%70500000-0000-0000-0000-00000000a00%'
      and (select v from r where k = 'p1')::text not like '%70500000-0000-0000-0000-00000000b001%', '다른 가족의 어르신·답은 섞이지 않는다');
select ok((select string_agg(v::text, ' ') from r where k like 'p%') !~ '(@|child[12]-7050|0000000000c[12]|00000000c00)', '자녀 계정 정보(메일·user id·프로필 id)는 없다');

-- 동의 철회: 자녀와 똑같이 바로 사라진다
update public.profiles set consented_at = null where id = '70500000-0000-0000-0000-00000000a002';
select pg_temp.act_as('70500000-0000-0000-0000-0000000000c1', false);
update r set v = public.child_summary() where k = 'cs';
update r set v = public.child_answer_history() where k = 'ch';
select pg_temp.act_as('70500000-0000-0000-0000-0000000000a2', true);
update r set v = public.parent_preview_child_view() where k = 'p2';
reset role;
select is((select v from r where k = 'p2'), pg_temp.child_entry('70500000-0000-0000-0000-00000000a002'), '철회 뒤에도 미리보기 = 자녀 화면 항목');
select ok((select v from r where k = 'p2') #> '{summary,parents,0,latest}' = 'null'::jsonb
      and jsonb_array_length((select v from r where k = 'p2') #> '{history,parents,0,answers}') = 0, '철회 즉시 최근 답·지난 답이 비어 보인다');

-- 실행 권한
select pg_temp.act_as('70500000-0000-0000-0000-0000000000c1', false);
select throws_like($$ select public.parent_preview_child_view() $$, '%parent_required%', '자녀 역할로는 실행할 수 없다');
select pg_temp.act_as('70500000-0000-0000-0000-0000000000e1', true);
select throws_like($$ select public.parent_preview_child_view() $$, '%parent_required%', '프로필 없는 기기는 실행할 수 없다');
reset role;
set local role anon;
select throws_ok($$ select public.parent_preview_child_view() $$, '42501', null, 'anon은 실행할 수 없다');
reset role;
select ok(not (has_function_privilege('authenticated', 'public.family_child_summary(uuid,uuid)', 'execute')
            or has_function_privilege('anon', 'public.family_child_summary(uuid,uuid)', 'execute')
            or has_function_privilege('service_role', 'public.family_child_summary(uuid,uuid)', 'execute')
            or has_function_privilege('authenticated', 'public.family_child_history(uuid,uuid)', 'execute')
            or has_function_privilege('anon', 'public.family_child_history(uuid,uuid)', 'execute')
            or has_function_privilege('service_role', 'public.family_child_history(uuid,uuid)', 'execute')),
          '공통 계산 함수는 앱·anon·서비스 역할 모두 직접 못 부른다(가족 id를 넘겨 남의 가족을 읽는 경로 차단)');

select * from finish();
rollback;
