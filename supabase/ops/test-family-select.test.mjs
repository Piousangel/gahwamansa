// 실행: node --test supabase/ops/test-family-select.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestEmail, selectTestFamilies } from './test-family-select.mjs';

test('isTestEmail: 테스트 도메인만', () => {
  for (const e of ['qa1@example.test', 'a@example.com', 'x@dev.example.org', 'k@family.test']) assert.equal(isTestEmail(e), true, e);
  for (const e of ['me@gmail.com', 'x@example.co.kr', 'test@naver.com', '', null]) assert.equal(isTestEmail(e), false, String(e));
});

test('selectTestFamilies: 모든 자녀가 테스트 계정인 가족만, 섞이면 건너뜀, 실제 가족은 보고도 안 함', () => {
  const users = [
    { id: 'u1', email: 'qa1@example.test', is_anonymous: false },
    { id: 'u2', email: 'qa2@example.test', is_anonymous: false },
    { id: 'u3', email: 'mom@gmail.com', is_anonymous: false },
    { id: 'u4', email: 'real@naver.com', is_anonymous: false },
    { id: 'anon', email: null, is_anonymous: true },
  ];
  const children = [
    { id: 'c1', user_id: 'u1', family_id: 'F1' },
    { id: 'c2', user_id: 'u2', family_id: 'F1' },
    { id: 'c3', user_id: 'u1x', family_id: 'F2' },
    { id: 'c4', user_id: 'u2', family_id: 'F3' }, { id: 'c5', user_id: 'u3', family_id: 'F3' },
    { id: 'c6', user_id: 'u4', family_id: 'F4' },
  ];
  const r = selectTestFamilies(users, children);
  assert.deepEqual(r.families, [{ family_id: 'F1', child_profiles: ['c1', 'c2'] }]);
  assert.deepEqual(r.skipped, [{ family_id: 'F3', reason: '실제 계정 자녀가 함께 있어요' }]);
});
