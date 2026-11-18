// push-daily 단위 테스트. 실행: node --test supabase/functions/push-daily/lib.test.mts (Node 23.6+ 타입 제거 실행)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, classifyFcmError, getAccessToken, runDaily, safeEqual, sendAll, ANDROID_CHANNEL_ID, type Target } from './lib.mts';

const copy = { title: '가화만사성', body: '오늘의 사진이 왔어요' };
const t1: Target = { profile_id: 'p1', token: 'tok1', platform: 'android' };
const t2: Target = { profile_id: 'p1', token: 'tok2', platform: 'android' };

test('buildMessage: 알림·채널·종류만 담는다(개인정보 없음)', () => {
  const m = buildMessage(t1, copy);
  assert.equal(m.message.token, 'tok1');
  assert.deepEqual(m.message.notification, copy);
  assert.equal(m.message.android.notification.channel_id, ANDROID_CHANNEL_ID);
  assert.deepEqual(m.message.data, { kind: 'daily' });
  assert.ok(!JSON.stringify(m).includes('p1'), 'profile_id는 메시지에 없다');
});

test('classifyFcmError: 무효 토큰과 일시 실패를 나눈다', () => {
  assert.equal(classifyFcmError(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), 'invalid_token');
  assert.equal(classifyFcmError(400, { error: { status: 'INVALID_ARGUMENT' } }), 'invalid_token');
  assert.equal(classifyFcmError(429, { error: { status: 'RESOURCE_EXHAUSTED' } }), 'failed');
  assert.equal(classifyFcmError(500, null), 'failed');
  assert.equal(classifyFcmError(401, { error: { status: 'UNAUTHENTICATED' } }), 'failed');
});

test('safeEqual: 같을 때만 참, 빈 값은 거짓', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

async function makeServiceAccount() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
  return { sa: { client_email: 'svc@proj.iam.gserviceaccount.com', private_key: pem, project_id: 'proj' }, publicKey: kp.publicKey };
}
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

test('getAccessToken: RS256 서명된 JWT로 토큰을 받는다', async () => {
  const { sa, publicKey } = await makeServiceAccount();
  let assertion = '';
  const fetchFn = (async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assertion = new URLSearchParams(String(init.body)).get('assertion') ?? '';
    return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
  }) as unknown as typeof fetch;
  assert.equal(await getAccessToken(sa, fetchFn, 1000), 'at');
  const [h, c, s] = assertion.split('.');
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(c)));
  assert.equal(claims.iss, sa.client_email);
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging');
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${c}`)));
});

test('sendAll: 성공·무효·네트워크 실패를 토큰별로 돌려준다', async () => {
  const fetchFn = (async (_url: string, init: RequestInit) => {
    const token = JSON.parse(String(init.body)).message.token;
    if (token === 'tok1') return new Response('{}', { status: 200 });
    if (token === 'tok2') return new Response(JSON.stringify({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
    throw new Error('net');
  }) as unknown as typeof fetch;
  const r = await sendAll([t1, t2, { ...t1, token: 'tok3' }], copy, { projectId: 'proj', accessToken: 'at', fetchFn });
  assert.deepEqual(r.map((x) => x.status), ['sent', 'invalid_token', 'failed']);
});

function fakeRpc(targets: unknown) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === 'push_daily_targets') return targets;
    if (name === 'push_record') {
      const rs = args.p_results as { status: string }[];
      return { sent: rs.filter((x) => x.status === 'sent').length, failed: rs.filter((x) => x.status === 'failed').length, invalid: rs.filter((x) => x.status === 'invalid_token').length };
    }
    throw new Error(name);
  };
  return { rpc, calls };
}
const noFetch = (async () => { throw new Error('보내면 안 됨'); }) as unknown as typeof fetch;

test('runDaily: 창 밖이면 보내지도 기록하지도 않는다', async () => {
  const f = fakeRpc({ window_open: false, copy, targets: [t1], excluded: 0 });
  assert.equal((await runDaily({ rpc: f.rpc, serviceAccount: null, fetchFn: noFetch })).status, 'window_closed');
  assert.deepEqual(f.calls.map((c) => c.name), ['push_daily_targets']);
});

test('runDaily: 확정 문구가 없으면 보내지 않고 실행만 기록', async () => {
  const f = fakeRpc({ window_open: true, copy: null, targets: [t1], excluded: 3 });
  assert.deepEqual(await runDaily({ rpc: f.rpc, serviceAccount: null, fetchFn: noFetch }), { status: 'no_copy', excluded: 3 });
  assert.deepEqual(f.calls[1], { name: 'push_record', args: { p_kind: 'daily', p_results: [], p_excluded: 3 } });
});

test('runDaily: 서비스 계정이 없으면 dry-run(보내지도 sent 기록도 안 함)', async () => {
  const f = fakeRpc({ window_open: true, copy, targets: [t1, t2], excluded: 1 });
  assert.deepEqual(await runDaily({ rpc: f.rpc, serviceAccount: null, fetchFn: noFetch }), { status: 'dry_run', targets: 2, excluded: 1 });
  assert.equal(f.calls.length, 1);
});

test('runDaily: 보내고 결과를 기록한다', async () => {
  const { sa } = await makeServiceAccount();
  const f = fakeRpc({ window_open: true, copy, targets: [t1, t2], excluded: 4 });
  const fetchFn = (async (url: string, init: RequestInit) => {
    if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'at' }));
    const token = JSON.parse(String(init.body)).message.token;
    return token === 'tok1' ? new Response('{}') : new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 });
  }) as unknown as typeof fetch;
  assert.deepEqual(await runDaily({ rpc: f.rpc, serviceAccount: sa, fetchFn }), { status: 'done', sent: 1, failed: 0, invalid: 1, excluded: 4 });
  const rec = f.calls.find((c) => c.name === 'push_record')!;
  assert.deepEqual((rec.args.p_results as { status: string }[]).map((x) => x.status), ['sent', 'invalid_token']);
});
