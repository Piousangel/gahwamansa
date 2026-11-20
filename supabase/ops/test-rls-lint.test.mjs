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
