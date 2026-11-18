// 실행: node --test supabase/functions/_shared/service.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRpc, pickServiceKey, serviceKeyLog } from './service.mts';

const env = (m: Record<string, string>) => (k: string) => m[k];

test('새 secret 키: edge 이름 우선, apikey 헤더만(Bearer 없음)', () => {
  const k = pickServiceKey(env({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_def', edge: 'sb_secret_edge' }), SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' }));
  assert.deepEqual(k, { kind: 'secret', name: 'edge', headers: { apikey: 'sb_secret_edge' } });
});

test('edge가 없으면 default만, 다른 이름(ops 키 등)으로는 내려가지 않는다(L3)', () => {
  assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_def' }) }))?.headers.apikey, 'sb_secret_def');
  assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: JSON.stringify({ ops: 'sb_secret_ops' }) })), null);
  assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: JSON.stringify({ ops: 'sb_secret_ops' }), SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' }))?.kind, 'legacy');
  // edge 값이 다른 형식이면 default로
  assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: JSON.stringify({ edge: 'eyJx', default: 'sb_secret_def' }) }))?.name, 'default');
});

test('SUPABASE_SECRET_KEYS가 이상한 모양이어도 죽지 않고 폴백(L2)', () => {
  for (const raw of ['null', '[]', '["sb_secret_a"]', '5', '"sb_secret_a"', '{"edge":5}', '{"edge":null,"default":{"k":1}}']) {
    assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: raw, SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' }))?.kind, 'legacy', raw);
  }
});

test('기동 로그: 종류·이름·키 이름 목록만(값 없음)', () => {
  const get = env({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_def', ops: 'sb_secret_ops' }) });
  const line = serviceKeyLog(get, pickServiceKey(get));
  assert.equal(line, 'service_key=secret:default secret_key_names=default,ops');
  assert.ok(!line.includes('sb_secret'));
  assert.equal(serviceKeyLog(env({}), null), 'service_key=none secret_key_names=-');
});

test('새 키가 없거나 형식이 깨지면 옛 서비스 키로 폴백(apikey + Bearer)', () => {
  assert.deepEqual(pickServiceKey(env({ SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' })), { kind: 'legacy', name: 'service_role', headers: { apikey: 'eyJlegacy', Authorization: 'Bearer eyJlegacy' } });
  assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: 'not json', SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' }))?.kind, 'legacy');
  assert.equal(pickServiceKey(env({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'not-a-secret-key' }), SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' }))?.kind, 'legacy');
  assert.equal(pickServiceKey(env({})), null);
});

test('makeRpc: 키 헤더로 부르고, 실패하면 이름·상태만', async () => {
  const seen: Record<string, string>[] = [];
  const fetchFn = (async (_u: string, init: RequestInit) => {
    seen.push(init.headers as Record<string, string>);
    return new Response('{"ok":true}', { status: 200 });
  }) as unknown as typeof fetch;
  const rpc = makeRpc('https://ref.supabase.co', { kind: 'secret', name: 'edge', headers: { apikey: 'sb_secret_k' } }, fetchFn);
  assert.deepEqual(await rpc('push_daily_claim', {}), { ok: true });
  assert.equal(seen[0].apikey, 'sb_secret_k');
  assert.equal(seen[0].Authorization, undefined);
  const bad = makeRpc('https://ref.supabase.co', { kind: 'secret', name: 'edge', headers: { apikey: 'sb_secret_k' } },
    (async () => new Response('secret detail', { status: 401 })) as unknown as typeof fetch);
  await assert.rejects(bad('x', {}), (e: Error) => e.message === 'rpc_failed:x:401' && !e.message.includes('sb_secret'));
});
