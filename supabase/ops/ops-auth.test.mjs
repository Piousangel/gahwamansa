// 실행: node --test supabase/ops/ops-auth.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkTargetUrl, keyHeaders} from './ops-auth.mjs';

test('주소: https는 origin만, 로컬은 http 127.0.0.1·localhost만(M3)', () => {
  assert.deepEqual(checkTargetUrl('https://abcd.supabase.co/'), {origin: 'https://abcd.supabase.co'});
  assert.deepEqual(checkTargetUrl(' https://abcd.supabase.co/rest/v1 '), {origin: 'https://abcd.supabase.co'});
  assert.deepEqual(checkTargetUrl('http://127.0.0.1:54321'), {origin: 'http://127.0.0.1:54321'});
  assert.deepEqual(checkTargetUrl('http://localhost:54321'), {origin: 'http://localhost:54321'});
  for (const bad of ['http://abcd.supabase.co', 'http://127.0.0.1.evil.example', 'ftp://abcd.supabase.co', 'abcd.supabase.co', '', undefined,
                     'https://user:pw@abcd.supabase.co']) {
    assert.ok(checkTargetUrl(bad).problem, String(bad));
  }
});

test('키 헤더: 새 secret 키는 apikey만, 옛 키는 Bearer도', () => {
  assert.deepEqual(keyHeaders('sb_secret_x'), {apikey: 'sb_secret_x'});
  assert.deepEqual(keyHeaders('eyJx'), {apikey: 'eyJx', Authorization: 'Bearer eyJx'});
});
