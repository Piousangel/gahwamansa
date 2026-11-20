// 실행: node --test supabase/ops/test-rls-lint.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lintSql} from './test-rls-lint.mjs';

const lines = (v) => v.map((x) => x.line);

test('#218에서 찾은 헛통과 모양(앱 역할로 가족 수를 셈)을 잡는다', () => {
  const sql = [
    "select pg_temp.act_as('d0000000-0000-0000-0000-0000000000c1', false);",
    "select ok((public.create_family() ->> 'family_id') is not null, '가족 id');",
    "select is((select count(*)::int from public.families where created_by = 'x'), 1, '가족은 하나뿐');",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [3]);
});

test('reset role 뒤에 세거나 이유가 있는 rls:의도 표시면 통과, 표시만 있고 이유가 없으면 위반(#219 M1)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from public.answers), 0, '자녀는 못 읽는다'); -- rls:의도 자녀 answers 0행",
    "select is((select count(*)::int from public.cheers), 0, '응원'); -- rls:의도",
    "select is((select count(*)::int from public.cheers), 0, '응원'); -- rls:의도   ",
    'reset role;',
    "select is((select count(*)::int from public.families), 1, '가족 하나');",
    'set local role anon;',
    "select ok(not exists (select 1 from public.cheers), '없음');",
  ].join('\n');
  const v = lintSql(sql);
  assert.deepEqual(lines(v), [3, 4, 8]);
  assert.deepEqual(v.map((x) => x.why), ['no_reason', 'no_reason', 'no_mark']);
});

test('여러 줄 단언은 세미콜론까지 모아서 본다(#219 L1)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    'select is(',
    '  (select count(*)::int',
    "     from public.families where created_by = 'x'),",
    "  1, '가족 하나');",
    'select is(',
    "  (select count(*)::int from public.answers), 0,",
    "  '자녀 0행'); -- rls:의도 자녀 answers 0행",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [2]);
});

test('set role(local 없음)과 역할을 바꾸는 다른 pg_temp 도우미도 앱 역할로 본다(#219 L2)', () => {
  const sql = [
    'set role authenticated;',
    "select is((select count(*)::int from public.answers), 0, 'a');",
    'reset role;',
    'create function pg_temp.as_child(p uuid) returns void language plpgsql as $$',
    'begin',
    "  perform set_config('request.jwt.claims', '{}', true);",
    "  execute 'set role authenticated';",
    'end $$;',
    "select pg_temp.as_child('c1');",
    "select is((select count(*)::int from public.cheers), 0, 'b');",
    'set role postgres;',
    "select is((select count(*)::int from public.cheers), 0, 'c');",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [2, 10]);
});

test('함수 반환값을 세는 단언·주석 줄은 대상이 아니다', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from jsonb_array_elements(public.child_summary() -> 'parents') e), 2, '요약');",
    "-- select is((select count(*)::int from public.answers), 0, '주석');",
  ].join('\n');
  assert.deepEqual(lintSql(sql), []);
});

// ---- #219 2차 리뷰 L: 넓힌 모양(모양마다 고정 1건) ----
test('count(*)가 아닌 셈(count(1)·count(id))도 잡는다', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(1)::int from public.families), 1, 'a');",
    "select is((select count(id)::int from public.families), 1, 'b');",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [2, 3]);
});

test('스키마를 생략한 from 표도 잡고, 함수 호출·pg_ 카탈로그·임시 표는 뺀다', () => {
  const sql = [
    'create temp table r (k text);',
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from families where created_by = 'x'), 1, '스키마 생략');",
    "select is((select count(*)::int from r), 1, '임시 표');",
    "select is((select count(*)::int from pg_proc where proname = 'x'), 1, '카탈로그');",
    "select is((select count(*)::int from jsonb_array_elements('[1]'::jsonb) e), 1, '함수');",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [3]);
});

test('결과 집합 단언(results_eq·set_eq·bag_eq·is_empty·isnt·row_eq)이 표를 읽으면 잡는다', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select results_eq($$ select id from public.cheers $$, $$ values (null::uuid) $$, 'r');",
    "select set_eq($$ select id from public.cheers $$, array[]::uuid[], 's');",
    "select bag_eq($$ select id from cheers $$, array[]::uuid[], 'b');",
    "select is_empty($$ select 1 from public.answers $$, 'e');",
    "select isnt((select count(*)::int from public.answers), 1, 'n');",
    "select row_eq($$ select role from public.profiles limit 1 $$, row('child'::text), 'w');",
    "select is_empty($$ select 1 from public.answers $$, 'e2'); -- rls:의도 자녀 answers 0행",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [2, 3, 4, 5, 6, 7]);
});

// ---- #222 리뷰 L(두 리뷰어): 오탐 3·놓침 2를 하나씩 고정 ----
test('CTE 이름은 표가 아니다(오탐 제외)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((with g as (select 1 as x) select count(*)::int from g), 1, 'cte');",
  ].join('\n');
  assert.deepEqual(lintSql(sql), []);
});

test('extract(… from …) 안의 from은 표가 아니다(오탐 제외)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select ok(exists (select 1 where extract(year from current_date) > 2000), 'extract');",
  ].join('\n');
  assert.deepEqual(lintSql(sql), []);
});

test('from public.함수(…)는 함수 호출이라 표가 아니다(오탐 제외)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from public.child_answer_history_rows()), 0, 'fn');",
  ].join('\n');
  assert.deepEqual(lintSql(sql), []);
});

test('count(distinct 열)도 잡는다(놓침 보강)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(distinct family_id)::int from public.profiles), 1, 'distinct');",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [2]);
});

test('public이 아닌 RLS 스키마(storage)의 표도 잡는다(놓침 보강)', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from storage.objects where bucket_id = 'content-photos'), 0, 'storage');",
  ].join('\n');
  assert.deepEqual(lines(lintSql(sql)), [2]);
});
