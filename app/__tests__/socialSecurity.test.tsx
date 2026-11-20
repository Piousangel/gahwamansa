// 보안 검토(2026-11-17 social-login-security) 후속 테스트
import {createRealApi} from '../src/features/realApi';
import type {SocialAuth} from '../src/features/socialAuth';
import {makeNonce, sha256Hex} from '../src/lib/sha256';

const social = (over: Partial<SocialAuth> = {}): SocialAuth => ({
  init: async () => {},
  kakao: jest.fn(async () => ({idToken: 'k'})),
  google: jest.fn(async () => ({idToken: 'g'})),
  signOut: jest.fn(async () => {}),
  unlinkKakao: jest.fn(async () => {}),
  ...over,
});

type Sess = {user: {id: string; is_anonymous?: boolean; app_metadata?: Record<string, unknown>}} | null;
function sb(opts: {session: Sess; parentProfile?: boolean; deleteError?: boolean}) {
  const calls: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = async () => ({data: opts.parentProfile ? {id: 'p'} : null, error: null});
  const client = {
    calls,
    auth: {
      getSession: async () => ({data: {session: opts.session}, error: null}),
      signOut: jest.fn(async (o?: {scope?: string}) => {
        calls.push(`signOut:${o?.scope ?? 'global'}`);
        return {error: null};
      }),
      signInWithIdToken: jest.fn(async (a: {provider: string}) => {
        calls.push(`idToken:${a.provider}`);
        return {data: {}, error: null};
      }),
    },
    from: () => builder,
    rpc: jest.fn(async (name: string) => {
      calls.push(`rpc:${name}`);
      if (name === 'delete_my_account') {
        return opts.deleteError ? {data: null, error: {code: 'P0001', message: 'no_profile'}} : {data: {scope: 'child'}, error: null};
      }
      return {data: {discarded: true}, error: null};
    }),
  };
  return client;
}

// ---- #4 어르신 기기 차단을 API 에도, 고아 익명 정리
test('연결된 어르신(익명+parent 프로필) 기기는 API 에서도 소셜 로그인을 막는다(SDK 호출 없음)', async () => {
  const c = sb({session: {user: {id: 'a', is_anonymous: true}}, parentProfile: true});
  const s = social();
  await expect(createRealApi(c as never, s).signInWithSocial('kakao')).rejects.toMatchObject({reason: 'parent_device'});
  expect(s.kakao).not.toHaveBeenCalled();
  expect(c.calls).not.toContain('idToken:kakao');
});

test('프로필 없는 익명 세션이면 SDK 로그인 뒤 서버에서 정리하고(로컬 로그아웃) 교환한다', async () => {
  const c = sb({session: {user: {id: 'a', is_anonymous: true}}, parentProfile: false});
  await createRealApi(c as never, social()).signInWithSocial('google');
  expect(c.calls).toEqual(['rpc:discard_anonymous_session', 'signOut:local', 'idToken:google']);
});

test('익명이 아닌 세션·세션 없음은 정리하지 않는다', async () => {
  const c1 = sb({session: null});
  await createRealApi(c1 as never, social()).signInWithSocial('google');
  expect(c1.calls).toEqual(['idToken:google']);
  const c2 = sb({session: {user: {id: 'c', is_anonymous: false}}});
  await createRealApi(c2 as never, social()).signInWithSocial('google');
  expect(c2.calls).toEqual(['idToken:google']);
});

test('취소하면 고아 정리도 하지 않는다(세션 유지)', async () => {
  const c = sb({session: {user: {id: 'a', is_anonymous: true}}});
  expect(await createRealApi(c as never, social({kakao: jest.fn(async () => 'cancelled' as const)})).signInWithSocial('kakao')).toBe('cancelled');
  expect(c.calls).toEqual([]);
});

// ---- #1·#2·#5 탈퇴 경로
test('탈퇴: 데이터 삭제 실패면 unlink·로그아웃을 하지 않는다', async () => {
  const c = sb({session: {user: {id: 'c', app_metadata: {provider: 'kakao', providers: ['kakao']}}}, deleteError: true});
  const s = social();
  await expect(createRealApi(c as never, s).deleteMyAccount()).rejects.toBeTruthy();
  expect(s.unlinkKakao).not.toHaveBeenCalled();
  expect(c.calls).not.toContain('signOut:local');
});

test('탈퇴: unlink 가 실패해도 SDK 로그아웃·Supabase 로그아웃은 진행(인증 계정은 서버가 삭제해 로컬만)', async () => {
  const c = sb({session: {user: {id: 'c', app_metadata: {provider: 'kakao', providers: ['kakao']}}}});
  const s = social({unlinkKakao: jest.fn(async () => Promise.reject(new Error('x')))});
  await createRealApi(c as never, s).deleteMyAccount();
  expect(s.signOut).toHaveBeenCalledWith('kakao');
  expect(c.calls).toContain('signOut:local');
});

test('탈퇴: 이메일로 가입 후 구글이 합쳐진 사용자(providers 배열)는 구글 SDK 도 정리', async () => {
  const c = sb({session: {user: {id: 'c', app_metadata: {provider: 'email', providers: ['email', 'google']}}}});
  const s = social();
  await createRealApi(c as never, s).deleteMyAccount();
  expect(s.signOut).toHaveBeenCalledWith('google');
  expect(s.unlinkKakao).not.toHaveBeenCalled();
});

test('#208 리뷰 H1: 서버 삭제 뒤 기기 정리(카카오 연결 끊기·로그아웃)가 응답하지 않아도 결과를 돌려준다(결과 화면으로 가게)', async () => {
  jest.useFakeTimers();
  try {
    const c = sb({session: {user: {id: 'c', app_metadata: {provider: 'kakao', providers: ['kakao']}}}});
    const hang = () => new Promise<never>(() => {});
    const s = social({unlinkKakao: jest.fn(hang), signOut: jest.fn(hang)});
    c.auth.signOut.mockImplementation(hang as never);
    let out: unknown = null;
    createRealApi(c as never, s)
      .deleteMyAccount()
      .then(r => {
        out = r;
      });
    const flush = () => new Promise(r => setImmediate(r)); // setImmediate 는 가짜 시계 대상이 아니다(jest.config)
    for (let i = 0; i < 10 && out === null; i++) {
      await flush();
      jest.advanceTimersByTime(3000); // 정리 하나당 3초 제한
      await flush();
    }
    expect(out).toEqual({scope: 'child'});
  } finally {
    jest.useRealTimers();
  }
});

// ---- nonce·SHA-256
test('nonce 는 64자 hex, 로그인마다 다르다', async () => {
  const a = makeNonce();
  const b = makeNonce();
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(a).not.toBe(b);
  const seen: string[] = [];
  const c = sb({session: null});
  const api = createRealApi(
    c as never,
    social({
      kakao: jest.fn(async (h: string) => {
        seen.push(h);
        return {idToken: 'k'};
      }),
    }),
  );
  await api.signInWithSocial('kakao');
  await api.signInWithSocial('kakao');
  expect(seen[0]).not.toBe(seen[1]);
});

test('SHA-256 경계(55·56·64바이트)와 NIST 2블록 벡터', () => {
  const node: {createHash(a: string): {update(s: string, e: string): {digest(e: string): string}}} = require('crypto');
  for (const n of [55, 56, 63, 64, 65, 119, 120]) {
    const s = 'a'.repeat(n);
    expect(sha256Hex(s)).toBe(node.createHash('sha256').update(s, 'utf8').digest('hex'));
  }
  expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});
