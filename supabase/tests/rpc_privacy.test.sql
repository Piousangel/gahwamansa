-- child_summary, withdraw_consent, set_parent_title, 자녀 직접 읽기 차단 테스트 (pgTAP). 실행: npx supabase test db
-- 보호하는 것: 자녀가 어르신의 답·세션 기록을 테이블에서 직접 읽지 못한다(동의 문구와 1:1로 RPC만 통로),
--             동의 전·철회 후에는 자녀 요약이 비어 있다, 철회하면 저장된 답이 지워진다, 호칭은 닫힌 목록만
begin;
select plan(22);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('71000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false), -- 자녀
  ('71000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false), -- 다른 가족 자녀
  ('71000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);  -- 어르신
insert into public.families (id, created_by) values
  ('7f000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-0000000000c1'),
  ('7f000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, user_id, family_id, role, consented_at, course_start_date) values
  ('7b000000-0000-0000-0000-0000000000c1', '71000000-0000-0000-0000-0000000000c1', '7f000000-0000-0000-0000-000000000001', 'child', null, public.kst_today()),
  ('7b000000-0000-0000-0000-0000000000c2', '71000000-0000-0000-0000-0000000000c2', '7f000000-0000-0000-0000-000000000002', 'child', null, public.kst_today()),
  ('7b000000-0000-0000-0000-0000000000a1', '71000000-0000-0000-0000-0000000000a1', '7f000000-0000-0000-0000-000000000001', 'parent', null, public.kst_today());
insert into public.content_questions (id, day_index, option_a, option_b, prompt) values
  ('7c000000-0000-0000-0000-000000000001', 1, '가을', '봄', '어느 계절이 좋으세요?');
insert into public.content_photos (day_index, image_url, caption, keyword, recall_questions) values
  (1, 'u1', 'cap1', 'k1', array['r1a', 'r1b']);

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;

-- 1~3. 동의 전: 자녀 요약은 "공유 안 함", 호칭 기본값은 부모님
select pg_temp.act_as('71000000-0000-0000-0000-0000000000c1', false);
select is((public.child_summary()) -> 'parents' -> 0 ->> 'shared', 'false', '동의 전에는 shared가 false다');
select is((public.child_summary()) -> 'parents' -> 0 -> 'latest', 'null'::jsonb, '동의 전에는 latest가 null이다');
select is((public.child_summary()) ->> 'parent_title', '부모님', '호칭 기본값은 부모님이다');

-- 어르신: 동의하고 답한다 (+ 세션 기록 남김)
select pg_temp.act_as('71000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$ select public.give_consent('v1') $$, '어르신이 동의 문구 버전과 함께 동의한다');
select public.save_answer('7c000000-0000-0000-0000-000000000001', 'A');
select public.record_session_step('photo', 30);

-- 5~6. 어르신 본인은 자기 답·세션을 계속 읽는다
select is((select count(*)::int from public.answers), 1, '어르신은 자기 답 1건을 본다'); -- rls:의도 RLS 확인: 본인 답 1행
select is((select count(*)::int from public.daily_sessions), 1, '어르신은 자기 세션 1건을 본다'); -- rls:의도 RLS 확인: 본인 세션 1행

-- 7~13. 자녀: 직접 읽기는 0행, 요약만 보인다
select pg_temp.act_as('71000000-0000-0000-0000-0000000000c1', false);
select is((select count(*)::int from public.answers), 0, '자녀는 answers를 직접 읽지 못한다(0행)'); -- rls:의도 RLS 확인: 자녀 answers 0행
select is((select count(*)::int from public.daily_sessions), 0, '자녀는 daily_sessions를 직접 읽지 못한다(0행)'); -- rls:의도 RLS 확인: 자녀 sessions 0행
select is((public.child_summary()) -> 'parents' -> 0 ->> 'shared', 'true', '동의 후에는 shared가 true다');
select is((public.child_summary()) -> 'parents' -> 0 -> 'latest' ->> 'prompt', '어느 계절이 좋으세요?', '최근 답의 질문 문장이 보인다');
select is((public.child_summary()) -> 'parents' -> 0 -> 'latest' ->> 'choice_label', '가을', '고른 선택지의 글자가 보인다');
select is(((public.child_summary()) -> 'parents' -> 0 -> 'latest' ->> 'answered_date')::date, public.kst_today(), '답한 날짜(KST)가 보인다');
-- 0019에서 parent_id·title(어르신 구분), 0021에서 connected(연결 끊김), 0041에서 connected_date(호칭 겹침 시트)가 추가됐다. 그 밖의 참여 정보는 없어야 한다.
select is(((public.child_summary()) -> 'parents' -> 0) - 'shared' - 'latest' - 'parent_id' - 'title' - 'connected' - 'connected_date', '{}'::jsonb, '요약에는 shared·latest·구분용 키 외에 단계·연속일·시간 등이 없다');

-- 14. 다른 가족 자녀는 이 가족의 어르신을 볼 수 없다
select pg_temp.act_as('71000000-0000-0000-0000-0000000000c2', false);
select is((public.child_summary()) -> 'parents', '[]'::jsonb, '다른 가족 자녀의 요약에는 어르신이 없다');

-- 15. 어르신은 child_summary를 호출할 수 없다
select pg_temp.act_as('71000000-0000-0000-0000-0000000000a1', true);
select throws_like($$ select public.child_summary() $$, '%child_required%', '어르신은 child_summary를 호출할 수 없다');

-- 16~19. 철회: 답이 지워지고 자녀 요약이 비며, 철회 후 저장은 거부된다
select lives_ok($$ select public.withdraw_consent() $$, '어르신이 동의를 철회한다');
select is((select count(*)::int from public.answers), 0, '철회하면 저장된 답이 지워진다'); -- rls:의도 고장 확인 11-20: 철회 때 안 지우면 have 1 → not ok 17
select throws_like($$ select public.save_answer('7c000000-0000-0000-0000-000000000001', 'B') $$, '%consent_required%', '철회 후에는 답을 저장할 수 없다');
select pg_temp.act_as('71000000-0000-0000-0000-0000000000c1', false);
select is((public.child_summary()) -> 'parents' -> 0 -> 'latest', 'null'::jsonb, '철회 후 자녀 요약의 latest는 null이다');

-- 20. 자녀는 철회를 호출할 수 없다
select throws_like($$ select public.withdraw_consent() $$, '%parent_required%', '자녀는 withdraw_consent를 호출할 수 없다');

-- 21. 호칭: 목록 안이면 저장, 밖이면 거부
select is((public.set_parent_title('엄마')) ->> 'ok', 'true', '목록 안의 호칭은 저장된다');
select is((public.set_parent_title('왕할머니')) ->> 'reason', 'invalid_title', '목록 밖의 호칭은 invalid_title로 거부된다');

select * from finish();
rollback;
