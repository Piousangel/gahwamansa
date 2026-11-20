// 실행: node --test supabase/ops/test-rls-lint.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lintSql} from './test-rls-lint.mjs';

test('#218에서 찾은 헛통과 모양(앱 역할로 가족 수를 셈)을 잡는다', () => {
  const sql = [
    "select pg_temp.act_as('d0000000-0000-0000-0000-0000000000c1', false);",
    "select ok((public.create_family() ->> 'family_id') is not null, '가족 id');",
    "select is((select count(*)::int from public.families where created_by = 'x'), 1, '가족은 하나뿐');",
  ].join('\n');
  assert.deepEqual(lintSql(sql).map((v) => v.line), [3]);
});

test('reset role 뒤에 세거나 rls:의도 표시가 있으면 통과', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from public.answers), 0, '자녀는 못 읽는다'); -- rls:의도 RLS 확인",
    'reset role;',
    "select is((select count(*)::int from public.families), 1, '가족 하나');",
    'set local role anon;',
    "select ok(not exists (select 1 from public.cheers), '없음');",
  ].join('\n');
  assert.deepEqual(lintSql(sql).map((v) => v.line), [6]);
});

test('함수 반환값을 세는 단언·주석 줄은 대상이 아니다', () => {
  const sql = [
    "select pg_temp.act_as('c1', false);",
    "select is((select count(*)::int from jsonb_array_elements(public.child_summary() -> 'parents') e), 2, '요약');",
    "-- select is((select count(*)::int from public.answers), 0, '주석');",
  ].join('\n');
  assert.deepEqual(lintSql(sql), []);
});
