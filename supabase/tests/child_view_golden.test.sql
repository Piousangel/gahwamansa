-- 자녀 화면·어르신 미리보기 골든 테스트 (pgTAP, PR #18 리뷰 L4). 실행: npx supabase test db
-- 보호하는 것: child_summary·child_answer_history·parent_preview_child_view의 **출력 전체**를 대표 픽스처의 기대 JSON으로 고정한다.
--   0065: latest·answers[]에 care(챙겨 드릴 거리, 스위치 꺼짐 = null).
--   0061: 어르신 항목에 recalls(② 고른 낱말)·pass_ons(⑤ 틀 키 + 끼울 값) 두 배열. answers 항목은 그대로, 미동의 어르신은 둘 다 [].
--   0050에서 계산부를 내부 함수(family_child_summary·family_child_history)로 옮겼으므로, 내부 함수를 고치면 자녀 화면과 미리보기가 함께 바뀐다.
--   "자녀 = 미리보기" 비교(parent_preview.test.sql)만으로는 둘이 같이 틀어져도 잡지 못하므로, 여기서 키·값·순서를 글자 그대로 고정한다.
--   기대값을 바꿔야 하는 변경이면 앱 계약(dev-server-notes §1·§2)도 함께 바꾼다.
begin;
select plan(4);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외
delete from public.answers; delete from public.content_photos; delete from public.content_questions;

insert into auth.users (id, aud, role, is_anonymous) values
  ('70510000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70510000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-0000000000c1', '엄마');
insert into public.profiles (id, user_id, family_id, role, consented_at, created_at, parent_title) values
  ('70510000-0000-0000-0000-00000000c001', '70510000-0000-0000-0000-0000000000c1', '70510000-0000-0000-0000-0000000000f1', 'child', null, '2026-11-09 03:00+00', null),
  ('70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000a1', '70510000-0000-0000-0000-0000000000f1', 'parent', now(), '2026-11-10 03:00+00', null),   -- 동의·연결, 가족 호칭
  ('70510000-0000-0000-0000-00000000a002', null, '70510000-0000-0000-0000-0000000000f1', 'parent', null, '2026-11-11 03:00+00', '아빠');                                    -- 미동의·연결 끊김, 개인 호칭
insert into public.content_questions (id, day_index, option_a, option_b, prompt, starter_a, starter_b) values
  ('70510000-0000-0000-0000-0000000000d1', 1, '가을', '봄', '어느 계절이 좋으세요?', '가을 이야기', '봄 이야기'),
  ('70510000-0000-0000-0000-0000000000d2', 2, '바다', '산', '어디로 가고 싶으세요?', '바다 이야기', '산 이야기');
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000d1', 'A', public.kst_today()),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000d2', 'B', public.kst_today() - 1),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000d2', 'A', public.kst_today() - 40), -- 30일 목록 밖
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a002', '70510000-0000-0000-0000-0000000000d1', 'A', public.kst_today());     -- 미동의(보이면 안 됨)
-- 0061: ② 고른 것·⑤ 건넨 말(스위치 켬). 미동의 어르신(a002)의 행은 보이면 안 된다(픽스처로 직접 넣음 — RPC로는 저장 자체가 거부됨)
insert into public.content_photos (day_index, image_url, caption, keyword) values (1, 'u1', '시골집 부엌', '부엌');
insert into public.content_recall_options (day_index, slot, label) values (1, 1, '아궁이'), (1, 2, '누룽지'), (1, 3, '가마솥');
insert into public.daily_sessions (family_id, parent_id, session_date, day_index, question_id, completed_steps) values
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a001', public.kst_today(), 1, '70510000-0000-0000-0000-0000000000d1', '{photo,recall,question}'),
  ('70510000-0000-0000-0000-0000000000f1', '70510000-0000-0000-0000-00000000a002', public.kst_today(), 1, '70510000-0000-0000-0000-0000000000d1', '{photo,recall}');
insert into public.recall_picks (parent_id, family_id, session_date, day_index, slot) values
  ('70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000f1', public.kst_today(), 1, 2),
  ('70510000-0000-0000-0000-00000000a002', '70510000-0000-0000-0000-0000000000f1', public.kst_today(), 1, 1);
insert into public.pass_on_picks (parent_id, family_id, session_date, day_index, line_key) values
  ('70510000-0000-0000-0000-00000000a001', '70510000-0000-0000-0000-0000000000f1', public.kst_today(), 1, 'recall_story');
insert into public.server_flags (name, enabled) values ('pass_on_store_enabled', true) on conflict (name) do update set enabled = true;

create function pg_temp.act_as(p_uid uuid, p_anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid, boolean) to public;
-- 기대 JSON의 {T0}·{T1}을 오늘·어제(KST)로 바꾼다
create function pg_temp.golden(p text) returns jsonb language sql as $$
  select replace(replace(p, '{T0}', public.kst_today()::text), '{T1}', (public.kst_today() - 1)::text)::jsonb
$$;
grant execute on function pg_temp.golden(text) to public;
create temp table g (k text primary key, v jsonb);
insert into g values
('summary', pg_temp.golden($j${"parent_title": "엄마", "parents": [
  {"parent_id": "70510000-0000-0000-0000-00000000a001", "title": "엄마", "connected": true, "connected_date": "2026-11-10", "shared": true,
   "latest": {"prompt": "어느 계절이 좋으세요?", "choice_label": "가을", "starter": "가을 이야기", "care": null, "answered_date": "{T0}"}},
  {"parent_id": "70510000-0000-0000-0000-00000000a002", "title": "아빠", "connected": false, "connected_date": "2026-11-11", "shared": false, "latest": null}]}$j$)),
('history', pg_temp.golden($j${"parents": [
  {"parent_id": "70510000-0000-0000-0000-00000000a001", "title": "엄마", "connected": true, "shared": true, "answers": [
    {"session_date": "{T0}", "prompt": "어느 계절이 좋으세요?", "prompt_short": "가을과 봄 중", "option_a": "가을", "option_b": "봄", "choice_label": "가을", "care": null},
    {"session_date": "{T1}", "prompt": "어디로 가고 싶으세요?", "prompt_short": "바다와 산 중", "option_a": "바다", "option_b": "산", "choice_label": "산", "care": null}],
   "recalls": [{"session_date": "{T0}", "label": "누룽지"}],
   "pass_ons": [{"session_date": "{T0}", "line_key": "recall_story", "recall_label": "누룽지", "choice_label": "가을", "option_a": "가을", "option_b": "봄"}]},
  {"parent_id": "70510000-0000-0000-0000-00000000a002", "title": "아빠", "connected": false, "shared": false, "answers": [], "recalls": [], "pass_ons": []}]}$j$));
grant select on g to authenticated;

select pg_temp.act_as('70510000-0000-0000-0000-0000000000c1', false);
select is(public.child_summary(), (select v from g where k = 'summary'), 'child_summary 출력 전체가 골든과 같다');
select is(public.child_answer_history(), (select v from g where k = 'history'), 'child_answer_history 출력 전체가 골든과 같다');

select pg_temp.act_as('70510000-0000-0000-0000-0000000000a1', true);
select is(public.parent_preview_child_view(), jsonb_build_object(
  'summary', jsonb_build_object('parent_title', '엄마', 'parents', jsonb_build_array((select v from g where k = 'summary') -> 'parents' -> 0)),
  'history', jsonb_build_object('parents', jsonb_build_array((select v from g where k = 'history') -> 'parents' -> 0))),
  '어르신 미리보기 출력 전체가 골든(본인 항목)과 같다');
select is((select array_agg(k order by k) from jsonb_object_keys(public.parent_preview_child_view()) k), array['history', 'summary'],
          '미리보기 최상위 키는 summary·history 두 개');
reset role;

select * from finish();
rollback;
