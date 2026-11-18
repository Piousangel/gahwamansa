// push-daily 단위 테스트. 실행: node --test supabase/functions/push-daily/lib.test.mts (Node 23.6+ 타입 제거 실행)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, classifyFcmError, getAccessToken, runDaily, safeEqual, sendAll, ANDROID_CHANNEL_ID, type Target } from './lib.mts';

const copy = { title: '가화만사성', body: '오늘의 사진이 왔어요' };
const t1: Target = { profile_id: 'p1', token: 'tok1', platform: 'android' };
const t2: Target = { profile_id: 'p1', token: 'tok2', platform: 'android' };
const fcmErr = (status: string, details: unknown[] = []) => ({ error: { status, details } });
const unregistered = fcmErr('NOT_FOUND', [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }]);
const badToken = fcmErr('INVALID_ARGUMENT', [{ errorCode: 'INVALID_ARGUMENT' }, { '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'message.token', description: 'Invalid registration token' }] }]);

test('buildMessage: 알림·채널·종류만 담는다(개인정보 없음)', () => {
  const m = buildMessage(t1, copy);
  assert.equal(m.message.token, 'tok1');
  assert.deepEqual(m.message.notification, copy);
  assert.equal(m.message.android.notification.channel_id, ANDROID_CHANNEL_ID);
  assert.deepEqual(m.message.data, { kind: 'daily' });
  assert.ok(!JSON.stringify(m).includes('p1'), 'profile_id는 메시지에 없다');
});

test('classifyFcmError(M3): 토큰을 지우는 것은 UNREGISTERED·message.token 오류뿐', () => {
  assert.equal(classifyFcmError(404, unregistered), 'invalid_token');
  assert.equal(classifyFcmError(400, badToken), 'invalid_token');
  assert.equal(classifyFcmError(404, fcmErr('NOT_FOUND')), 'config_error', '프로젝트 404는 설정 오류');
  assert.equal(classifyFcmError(400, fcmErr('INVALID_ARGUMENT', [{ errorCode: 'INVALID_ARGUMENT' }, { fieldViolations: [{ field: 'message.android.notification.channel_id' }] }])), 'failed', '토큰이 아닌 형식 오류는 그 건만 실패(R-M1)');
  assert.equal(classifyFcmError(400, fcmErr('INVALID_ARGUMENT', [{ errorCode: 'INVALID_ARGUMENT' }])), 'failed', '필드 없는 INVALID_ARGUMENT도 그 건만 실패(R-M1)');
  assert.equal(classifyFcmError(401, fcmErr('UNAUTHENTICATED')), 'config_error');
  assert.equal(classifyFcmError(403, fcmErr('PERMISSION_DENIED', [{ errorCode: 'SENDER_ID_MISMATCH' }])), 'invalid_token', '다른 프로젝트 토큰은 그 토큰만 삭제(R-M1)');
  assert.equal(classifyFcmError(403, fcmErr('PERMISSION_DENIED', [{ errorCode: 'THIRD_PARTY_AUTH_ERROR' }])), 'config_error');
  assert.equal(classifyFcmError(429, fcmErr('RESOURCE_EXHAUSTED')), 'failed');
  assert.equal(classifyFcmError(503, null), 'failed');
});

test('safeEqual(L6): 같을 때만 참, 빈 값·길이 다름은 거짓', async () => {
  assert.equal(await safeEqual('abc', 'abc'), true);
  assert.equal(await safeEqual('abc', 'abd'), false);
  assert.equal(await safeEqual('', ''), false);
  assert.equal(await safeEqual('abc', 'abcd'), false);
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
    if (token === 'tok2') return new Response(JSON.stringify(unregistered), { status: 404 });
    throw new Error('net');
  }) as unknown as typeof fetch;
  const { results, aborted } = await sendAll([t1, t2, { ...t1, token: 'tok3' }], copy, { projectId: 'proj', accessToken: 'at', fetchFn });
  assert.deepEqual(results.map((x) => x.status), ['sent', 'invalid_token', 'failed']);
  assert.equal(aborted, false);
});

test('sendAll(R-M1): SENDER_ID_MISMATCH 토큰 한 개는 나머지 발송을 막지 않는다', async () => {
  const fetchFn = (async (_url: string, init: RequestInit) => {
    const token = JSON.parse(String(init.body)).message.token;
    if (token === 'bad') return new Response(JSON.stringify(fcmErr('PERMISSION_DENIED', [{ errorCode: 'SENDER_ID_MISMATCH' }])), { status: 403 });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  const list = [{ ...t1, token: 'bad' }, ...Array.from({ length: 5 }, (_, i) => ({ ...t1, token: `ok${i}` }))];
  const { results, aborted } = await sendAll(list, copy, { projectId: 'proj', accessToken: 'at', fetchFn, concurrency: 1 });
  assert.equal(aborted, false);
  assert.deepEqual(results.map((r) => r.status), ['invalid_token', 'sent', 'sent', 'sent', 'sent', 'sent']);
});

test('sendAll(R-M1): 설정 오류가 토큰 2개면 계속, 서로 다른 토큰 3개면 멈춘다', async () => {
  const mk = (bad: number) => (async (_url: string, init: RequestInit) => {
    const token = JSON.parse(String(init.body)).message.token as string;
    const n = Number(token.slice(3));
    return n < bad ? new Response(JSON.stringify(fcmErr('UNAUTHENTICATED')), { status: 401 }) : new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  const list = Array.from({ length: 6 }, (_, i) => ({ ...t1, token: `tok${i}` }));
  const two = await sendAll(list, copy, { projectId: 'p', accessToken: 'at', fetchFn: mk(2), concurrency: 1 });
  assert.equal(two.aborted, false);
  assert.equal(two.results.filter((r) => r.status === 'sent').length, 4);
  const three = await sendAll(list, copy, { projectId: 'p', accessToken: 'at', fetchFn: mk(6), concurrency: 1 });
  assert.equal(three.aborted, true);
  assert.equal(three.results.filter((r) => r.status === 'failed').length, 6, '멈춘 뒤 남은 대상도 failed(삭제 없음)');
});

test('sendAll(M3): 설정 오류가 계속 나면 멈추고 모두 failed(토큰 삭제 없음)', async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls++;
    return new Response(JSON.stringify(fcmErr('NOT_FOUND')), { status: 404 });
  }) as unknown as typeof fetch;
  const many = Array.from({ length: 20 }, (_, i) => ({ ...t1, token: `tok${i}` }));
  const { results, aborted } = await sendAll(many, copy, { projectId: 'wrong', accessToken: 'at', fetchFn, concurrency: 1 });
  assert.equal(aborted, true);
  assert.equal(calls, 3, '서로 다른 토큰 3개째 설정 오류에서 멈춘다');
  assert.ok(results.every((r) => r.status === 'failed'), '무효로 표시하지 않는다');
});

function fakeRpc(targets: unknown) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === 'push_daily_targets' || name === 'push_daily_claim') return targets;
    if (name === 'push_record') {
      const rs = args.p_results as { status: string }[];
      return { sent: rs.filter((x) => x.status === 'sent').length, failed: rs.filter((x) => x.status === 'failed').length, invalid: rs.filter((x) => x.status === 'invalid_token').length, note: args.p_note ?? null };
    }
    throw new Error(name);
  };
  return { rpc, calls };
}
const noFetch = (async () => { throw new Error('보내면 안 됨'); }) as unknown as typeof fetch;

test('runDaily: 창 밖이면 보내지도 기록하지도 않는다', async () => {
  const { sa } = await makeServiceAccount();
  const f = fakeRpc({ window_open: false, copy, targets: [], excluded: 0 });
  assert.equal((await runDaily({ rpc: f.rpc, serviceAccount: sa, fetchFn: noFetch })).status, 'window_closed');
  assert.deepEqual(f.calls.map((c) => c.name), ['push_daily_claim']);
});

test('runDaily: 확정 문구가 없으면 보내지 않고 실행만 기록(no_copy)', async () => {
  const { sa } = await makeServiceAccount();
  const f = fakeRpc({ window_open: true, copy: null, targets: [], excluded: 3 });
  assert.deepEqual(await runDaily({ rpc: f.rpc, serviceAccount: sa, fetchFn: noFetch }), { status: 'no_copy', excluded: 3 });
  assert.deepEqual(f.calls[1], { name: 'push_record', args: { p_kind: 'daily', p_results: [], p_excluded: 3, p_note: 'no_copy' } });
});

test('runDaily: 서비스 계정이 없으면 dry-run — 선점하지 않는 미리보기만, 보내지도 기록하지도 않음', async () => {
  const f = fakeRpc({ window_open: true, copy, targets: [t1, t2], excluded: 1 });
  assert.deepEqual(await runDaily({ rpc: f.rpc, serviceAccount: null, fetchFn: noFetch }), { status: 'dry_run', targets: 2, excluded: 1 });
  assert.deepEqual(f.calls.map((c) => c.name), ['push_daily_targets']);
});

test('runDaily(M4): 실제 발송은 선점 함수로 대상을 받고 결과를 기록한다', async () => {
  const { sa } = await makeServiceAccount();
  const f = fakeRpc({ window_open: true, copy, targets: [t1, t2], excluded: 4 });
  const fetchFn = (async (url: string, init: RequestInit) => {
    if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'at' }));
    const token = JSON.parse(String(init.body)).message.token;
    return token === 'tok1' ? new Response('{}') : new Response(JSON.stringify(badToken), { status: 400 });
  }) as unknown as typeof fetch;
  const r = await runDaily({ rpc: f.rpc, serviceAccount: sa, fetchFn });
  assert.equal(r.status, 'done');
  assert.equal(f.calls[0].name, 'push_daily_claim');
  const rec = f.calls.find((c) => c.name === 'push_record')!;
  assert.deepEqual((rec.args.p_results as { status: string }[]).map((x) => x.status), ['sent', 'invalid_token']);
  assert.equal(rec.args.p_note, null);
});

test('runDaily: 인증 토큰 실패면 선점분을 failed로 기록하고 config_error', async () => {
  const { sa } = await makeServiceAccount();
  const f = fakeRpc({ window_open: true, copy, targets: [t1], excluded: 0 });
  const fetchFn = (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch;
  const r = await runDaily({ rpc: f.rpc, serviceAccount: sa, fetchFn });
  assert.equal(r.status, 'config_error');
  const rec = f.calls.find((c) => c.name === 'push_record')!;
  assert.equal(rec.args.p_note, 'oauth_failed');
  assert.deepEqual((rec.args.p_results as { status: string }[]).map((x) => x.status), ['failed']);
});
