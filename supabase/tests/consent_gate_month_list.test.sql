-- 0068 테스트 (pgTAP): 부모님 동의 버전 게이트 + 자녀 홈 '최근 한 달 고르신 것'(child_summary.parents[].month). 실행: npx supabase test db
-- 보호하는 것: v6 이상 동의한 어르신만 month 키(v5·미응답·버전 없음·철회는 키 자체 없음 = 0067 응답 그대로) / 'v10'도 v6 이상(정수 비교) /
--             다른 가족의 어르신은 어디에도 없음 / care: 스위치 꺼짐 null, 켜도 v5는 null(latest·history 포함), v6은 고른 쪽 문장 하나만 /
--             기간 D-29..D(D-30은 파기 전이어도 안 보임, 파기 0023은 D-31부터 지움) / 항목 키 7개뿐 — 횟수·순위·갈래 없음 /
--             게이트 함수는 내부 전용 / 어르신 미리보기(0050)도 같은 게이트.
begin;
select plan(22);
select set_config('bumo.allow_content_delete', 'on', true); -- 테스트 픽스처: 게시 콘텐츠 삭제 금지(0024)의 명시적 예외

insert into auth.users (id, aud, role, is_anonymous) values
  ('70680000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', false),
  ('70680000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', false),
  ('70680000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', true),
  ('70680000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', true),
  ('70680000-0000-0000-0000-0000000000a0', 'authenticated', 'authenticated', true),
  ('70680000-0000-0000-0000-0000000000aa', 'authenticated', 'authenticated', true),
  ('70680000-0000-0000-0000-0000000000b6', 'authenticated', 'authenticated', true);
insert into public.families (id, created_by, parent_title) values
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-0000000000c1', '엄마'),
  ('70680000-0000-0000-0000-0000000000f2', '70680000-0000-0000-0000-0000000000c2', '아빠');
-- 0069부터 게이트는 허용 목록(consent_versions) 안의 값만 본다. 아래 'v10' 어르신은 "v10이 목록에 들어온 뒤"를 가정한다
-- (정수 비교 고정이 이 파일의 목적 — 목록 밖 값(v7·v999)은 consent_version_allowlist.test.sql). 트랜잭션 끝에 rollback으로 원래 목록.
create or replace function public.consent_versions() returns text[]
language sql immutable set search_path = ''
as $$ select array['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v10'] $$;
insert into public.profiles (id, user_id, family_id, role, consented_at, consent_version, created_at) values
  ('70680000-0000-0000-0000-00000000c001', '70680000-0000-0000-0000-0000000000c1', '70680000-0000-0000-0000-0000000000f1', 'child', null, null, '2026-11-01 00:00+00'),
  ('70680000-0000-0000-0000-00000000a006', '70680000-0000-0000-0000-0000000000a6', '70680000-0000-0000-0000-0000000000f1', 'parent', now(), 'v6', '2026-11-02 00:00+00'),   -- v6
  ('70680000-0000-0000-0000-00000000a005', '70680000-0000-0000-0000-0000000000a5', '70680000-0000-0000-0000-0000000000f1', 'parent', now(), 'v5', '2026-11-03 00:00+00'),   -- v5
  ('70680000-0000-0000-0000-00000000a000', '70680000-0000-0000-0000-0000000000a0', '70680000-0000-0000-0000-0000000000f1', 'parent', null, null, '2026-11-04 00:00+00'),   -- 미응답
  ('70680000-0000-0000-0000-00000000a010', '70680000-0000-0000-0000-0000000000aa', '70680000-0000-0000-0000-0000000000f1', 'parent', now(), 'v10', '2026-11-05 00:00+00'), -- v10(문자열 비교면 'v10' < 'v6')
  ('70680000-0000-0000-0000-00000000c002', '70680000-0000-0000-0000-0000000000c2', '70680000-0000-0000-0000-0000000000f2', 'child', null, null, '2026-11-01 00:00+00'),
  ('70680000-0000-0000-0000-00000000b006', '70680000-0000-0000-0000-0000000000b6', '70680000-0000-0000-0000-0000000000f2', 'parent', now(), 'v6', '2026-11-02 00:00+00'); -- 다른 가족 v6
insert into public.content_questions (id, day_index, option_a, option_b, prompt, care_a, care_b) values
  ('70680000-0000-0000-0000-0000000000d1', 9068, '단감', '홍시', '어느 맛이 더 좋으세요?', '단감 한 상자 챙겨 가기', '홍시 한 상자 챙겨 가기'),
  ('70680000-0000-0000-0000-0000000000d2', 9069, '바다', '산', '어디로 가고 싶으세요?', '바닷가 당일 나들이', '가까운 산 산책');
insert into public.answers (family_id, parent_id, question_id, choice, session_date) values
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a006', '70680000-0000-0000-0000-0000000000d1', 'B', public.kst_today()),
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a006', '70680000-0000-0000-0000-0000000000d2', 'A', public.kst_today() - 29), -- 창 끝(보임)
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a006', '70680000-0000-0000-0000-0000000000d1', 'A', public.kst_today() - 30), -- 창 밖(파기 전이어도 안 보임)
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a006', '70680000-0000-0000-0000-0000000000d2', 'B', public.kst_today() - 31), -- 파기 대상
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a005', '70680000-0000-0000-0000-0000000000d1', 'B', public.kst_today()),
  ('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a010', '70680000-0000-0000-0000-0000000000d1', 'A', public.kst_today()),
  ('70680000-0000-0000-0000-0000000000f2', '70680000-0000-0000-0000-00000000b006', '70680000-0000-0000-0000-0000000000d2', 'B', public.kst_today());

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.act_as(uuid) to public;
create temp table r (k text primary key, v jsonb);
grant select, insert, update on r to authenticated;
-- 어르신 항목 찾기(순서에 기대지 않게)
create function pg_temp.par(p_k text, p_id text) returns jsonb language sql as $$
  select e from r, jsonb_array_elements(r.v -> 'parents') e where r.k = p_k and e ->> 'parent_id' = p_id $$;
grant execute on function pg_temp.par(text, text) to public;

-- ---- 스위치 꺼짐(기본) ----
select pg_temp.act_as('70680000-0000-0000-0000-0000000000c1');
insert into r values ('off', public.child_summary()), ('hist_off', public.child_answer_history());
reset role;

select ok(pg_temp.par('off', '70680000-0000-0000-0000-00000000a006') ? 'month', 'v6 어르신 → month 키가 있다');
select is((select array_agg(e ->> 'session_date' order by ord)::text[] from jsonb_array_elements(pg_temp.par('off', '70680000-0000-0000-0000-00000000a006') -> 'month') with ordinality x(e, ord)),
          array[public.kst_today()::text, (public.kst_today() - 29)::text], 'month = D·D-29 날짜 내림차순(D-30·D-31은 없음)');
select is((select jsonb_agg(k order by k) from jsonb_object_keys(pg_temp.par('off', '70680000-0000-0000-0000-00000000a005')) k),
          '["connected", "connected_date", "latest", "parent_id", "shared", "title"]'::jsonb, 'v5 어르신 → 키가 0067과 같다(month 없음)');
select ok(not (pg_temp.par('off', '70680000-0000-0000-0000-00000000a000') ? 'month')
          and (pg_temp.par('off', '70680000-0000-0000-0000-00000000a000') ->> 'shared')::boolean = false, '미응답 어르신 → month 없음, shared false');
select ok(pg_temp.par('off', '70680000-0000-0000-0000-00000000a010') ? 'month', 'v10 → month 있음(정수 비교)');
select is(pg_temp.par('off', '70680000-0000-0000-0000-00000000a006') -> 'month' -> 0 -> 'care', 'null'::jsonb, '스위치 꺼짐 → month[].care = null(키는 있음)');
select is((select jsonb_agg(k order by k) from jsonb_object_keys(pg_temp.par('off', '70680000-0000-0000-0000-00000000a006') -> 'month' -> 0) k),
          '["care", "choice_label", "option_a", "option_b", "prompt", "prompt_short", "session_date"]'::jsonb,
          'month 항목 키는 7개뿐(history answers[]와 같은 모양) — 횟수·순위·갈래 없음');
select is(pg_temp.par('off', '70680000-0000-0000-0000-00000000a006') -> 'month' -> 0 ->> 'choice_label', '홍시', '고르신 보기(B)');
select is((select count(*)::int from r, jsonb_array_elements(r.v -> 'parents') e where r.k = 'off'), 4, '자기 가족 어르신 4명만');
select ok(position('70680000-0000-0000-0000-00000000b006' in (select v::text from r where k = 'off')) = 0
          and position('70680000-0000-0000-0000-00000000b006' in (select v::text from r where k = 'hist_off')) = 0, '다른 가족 어르신은 요약·지난 답 어디에도 없다');

-- 다른 가족 자녀: 자기 가족 v6 어르신 한 명만, 우리 가족 답 없음
select pg_temp.act_as('70680000-0000-0000-0000-0000000000c2');
insert into r values ('other', public.child_summary());
reset role;
select ok(jsonb_array_length((select v -> 'parents' from r where k = 'other')) = 1
          and jsonb_array_length(pg_temp.par('other', '70680000-0000-0000-0000-00000000b006') -> 'month') = 1
          and position('홍시' in (select v::text from r where k = 'other')) = 0, '다른 가족 자녀는 자기 어르신의 한 달만 본다');

-- ---- 스위치 켬(운영자) ----
insert into public.server_flags (name, enabled) values ('care_lines_enabled', true) on conflict (name) do update set enabled = true;
select pg_temp.act_as('70680000-0000-0000-0000-0000000000c1');
insert into r values ('on', public.child_summary()), ('hist_on', public.child_answer_history());
reset role;
select is(pg_temp.par('on', '70680000-0000-0000-0000-00000000a006') -> 'month' -> 0 ->> 'care', '홍시 한 상자 챙겨 가기', '켬 + v6 → month[].care = 고른 쪽(B) 문장');
select is(pg_temp.par('on', '70680000-0000-0000-0000-00000000a006') -> 'latest' ->> 'care', '홍시 한 상자 챙겨 가기', '켬 + v6 → latest.care도 고른 쪽 문장');
select ok(position('단감 한 상자' in pg_temp.par('on', '70680000-0000-0000-0000-00000000a006')::text) = 0
          and pg_temp.par('on', '70680000-0000-0000-0000-00000000a010') -> 'month' -> 0 ->> 'care' = '단감 한 상자 챙겨 가기',
          '고르지 않은 쪽 문장은 그 어르신 항목 어디에도 없다(같은 질문에 A를 고른 v10 어르신에게는 A 문장)');
select is(pg_temp.par('on', '70680000-0000-0000-0000-00000000a005') -> 'latest' -> 'care', 'null'::jsonb, '켬이어도 v5 → latest.care = null(게이트)');
select is(pg_temp.par('hist_on', '70680000-0000-0000-0000-00000000a005') -> 'answers' -> 0 -> 'care', 'null'::jsonb, '켬이어도 v5 → 지난 답 answers[].care = null');
select ok(not ((select v::text from r where k = 'on') ~ '(count|rank|times|total|axis|category|갈래|번째|[0-9]+번)'), '응답에 횟수·순위·갈래 말이 없다');

-- 어르신 미리보기(0050)도 같은 게이트: 자녀가 보는 그 어르신 항목과 같다
select pg_temp.act_as('70680000-0000-0000-0000-0000000000a6');
insert into r values ('preview', public.parent_preview_child_view() -> 'summary');
reset role;
select is(pg_temp.par('preview', '70680000-0000-0000-0000-00000000a006'), pg_temp.par('on', '70680000-0000-0000-0000-00000000a006'), '미리보기 = 자녀 화면(month 포함)');

-- 동의를 v5로 다시 하면(옛 앱) month가 사라진다 / 철회해도 사라진다
update public.profiles set consent_version = 'v5' where id = '70680000-0000-0000-0000-00000000a006';
select pg_temp.act_as('70680000-0000-0000-0000-0000000000c1');
insert into r values ('down5', public.child_summary());
reset role;
select ok(not (pg_temp.par('down5', '70680000-0000-0000-0000-00000000a006') ? 'month')
          and pg_temp.par('down5', '70680000-0000-0000-0000-00000000a006') -> 'latest' -> 'care' = 'null'::jsonb, 'v5로 내려가면 month 없음·care null');
update public.profiles set consent_version = 'v6', consented_at = null where id = '70680000-0000-0000-0000-00000000a006';
select ok(not public.parent_month_scope('70680000-0000-0000-0000-00000000a006'), '버전이 v6이어도 철회(consented_at null)면 게이트 false');
update public.profiles set consented_at = now() where id = '70680000-0000-0000-0000-00000000a006';

-- 파기(0023)와 경계: D-31은 지워지고 D-30은 남지만 목록에는 없다
select public.purge_expired_data(now());
select ok(not exists (select 1 from public.answers where parent_id = '70680000-0000-0000-0000-00000000a006' and session_date = public.kst_today() - 31)
          and exists (select 1 from public.answers where parent_id = '70680000-0000-0000-0000-00000000a006' and session_date = public.kst_today() - 30)
          and jsonb_array_length((public.family_child_summary('70680000-0000-0000-0000-0000000000f1', '70680000-0000-0000-0000-00000000a006')) -> 'parents' -> 0 -> 'month') = 2,
          '파기는 D-31부터, 목록은 D-29까지 — 31일 넘은 답은 보이지 않는다');

select ok(not has_function_privilege('authenticated', 'public.parent_month_scope(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.parent_month_scope(uuid)', 'execute')
          and not has_function_privilege('service_role', 'public.parent_month_scope(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.family_child_summary(uuid, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.care_lines_visible(uuid)', 'execute'),
          '게이트·요약 내부 함수는 앱·anon·service_role이 못 부른다');

select * from finish();
rollback;
