// 실행: node --test supabase/functions/_shared/kakao.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUnlink, runUnlink, unlinkAll } from './kakao.mts';

test('classifyUnlink: 성공·이미 해제는 done, 그 밖은 retry', () => {
  assert.equal(classifyUnlink(200, { id: 1 }), 'done');
  assert.equal(classifyUnlink(400, { code: -101 }), 'done');
  assert.equal(classifyUnlink(400, { code: -103 }), 'done');
  assert.equal(classifyUnlink(401, { code: -401 }), 'config', '어드민 키 오류는 회차 중단(R-M1)');
  assert.equal(classifyUnlink(403, null), 'config');
  assert.equal(classifyUnlink(500, null), 'retry');
});

test('unlinkAll: Admin 키 헤더·대상 형식, 결과에 회원번호를 담지 않는다', async () => {
  const seen: { auth: string; body: string }[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    seen.push({ auth: String((init.headers as Record<string, string>).Authorization), body: String(init.body) });
    return String(init.body).includes('k2') ? new Response(JSON.stringify({ code: -500 }), { status: 500 }) : new Response('{"id":1}');
  }) as unknown as typeof fetch;
  const { results: r } = await unlinkAll([{ id: 1, kakao_user_id: 'k1' }, { id: 2, kakao_user_id: 'k2' }], 'ADMINKEY', fetchFn);
  assert.equal(seen[0].auth, 'KakaoAK ADMINKEY');
  assert.equal(seen[0].body, 'target_id_type=user_id&target_id=k1');
  assert.deepEqual(r, [{ id: 1, status: 'done' }, { id: 2, status: 'retry', http: 500 }]);
  assert.ok(!JSON.stringify(r).includes('k1'));
});

test('runUnlink: Admin 키가 없으면 선점하지 않는다', async () => {
  const calls: string[] = [];
  const r = await runUnlink({ rpc: async (n) => { calls.push(n); return []; }, adminKey: '', fetchFn: fetch });
  assert.deepEqual(r, { status: 'not_configured' });
  assert.deepEqual(calls, []);
});

test('runUnlink: 선점 → 해제 → 기록', async () => {
  const calls: { n: string; a: Record<string, unknown> }[] = [];
  const rpc = async (n: string, a: Record<string, unknown>) => {
    calls.push({ n, a });
    return n === 'kakao_unlink_claim' ? [{ id: 7, kakao_user_id: 'k7' }] : { done: 1, retry: 0, gave_up: 0 };
  };
  const fetchFn = (async () => new Response('{"id":7}')) as unknown as typeof fetch;
  assert.deepEqual(await runUnlink({ rpc, adminKey: 'K', fetchFn }), { status: 'done', done: 1, retry: 0, gave_up: 0 });
  assert.deepEqual(calls[1], { n: 'kakao_unlink_record', a: { p_results: [{ id: 7, status: 'done' }] } });
});

test('runUnlink(R-M1): 키 오류면 멈추고 남은 것의 선점을 풀어 준다(시도 횟수 보존)', async () => {
  const calls: { n: string; a: Record<string, unknown> }[] = [];
  const rpc = async (n: string, a: Record<string, unknown>) => {
    calls.push({ n, a });
    if (n === 'kakao_unlink_claim') return [{ id: 1, kakao_user_id: 'k1' }, { id: 2, kakao_user_id: 'k2' }, { id: 3, kakao_user_id: 'k3' }];
    if (n === 'kakao_unlink_release') return { released: (a.p_ids as number[]).length };
    return { done: 1, retry: 0, gave_up: 0 };
  };
  const fetchFn = (async (_u: string, init: RequestInit) =>
    String(init.body).includes('k1') ? new Response('{"id":1}') : new Response(JSON.stringify({ code: -401 }), { status: 401 })) as unknown as typeof fetch;
  const r = await runUnlink({ rpc, adminKey: 'BAD', fetchFn });
  assert.equal(r.status, 'config_error');
  assert.deepEqual(calls.map((c) => c.n), ['kakao_unlink_claim', 'kakao_unlink_record', 'kakao_unlink_release']);
  assert.deepEqual(calls[1].a, { p_results: [{ id: 1, status: 'done' }] });
  assert.deepEqual(calls[2].a, { p_ids: [2, 3], p_http: 401 });
});
