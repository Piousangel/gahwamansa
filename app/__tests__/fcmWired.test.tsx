// 내부 테스트 N1 '푸시 살리기'(FCM_WIRED 켬): real 모드가 FCM 토큰을 실제로 등록·갱신·정리하는 경로.
// FCM 모듈은 가짜(createFcmTokenSourceFrom)로, 앱 조립은 PushHost(AppRoot) 그대로. 서버 계약: dev-server-notes 2절(0032·0036·0037).
import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {createFcmTokenSourceFrom, registerBackgroundHandler} from '../src/push/fcmTokenSource';
import {registerToken, setReceive, childOptIn} from '../src/push/pushClient';
import {setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {readPushToken, setPushDevice, setPushTokenStoreForTest, setSettleMsForTest, SETTLE_MS} from '../src/lib/pushToken';

const RN = require('react-native');
const TOKEN_A = 'fcm_token_AAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TOKEN_B = 'fcm_token_BBBBBBBBBBBBBBBBBBBBBBBBBBBB';
/** 비동기 조립(권한 확인·등록)이 끝날 시간을 준다 — '일어나지 않음'을 볼 때만 */
const settle = () => new Promise<void>(r => setTimeout(() => r(), 50));

/** 가짜 @react-native-firebase/messaging(모듈러 API). 토큰 요청·자동 초기화·갱신 구독을 센다 */
function fakeMessaging(first = TOKEN_A) {
  let current = first;
  const refreshers: ((t: string) => void)[] = [];
  const mod = {
    getMessaging: jest.fn(() => ({})),
    getToken: jest.fn(async () => current),
    onTokenRefresh: jest.fn((_m: unknown, cb: (t: string) => void) => {
      refreshers.push(cb);
      return () => {
        refreshers.splice(refreshers.indexOf(cb), 1);
      };
    }),
    getInitialNotification: jest.fn(async () => null),
    onNotificationOpenedApp: jest.fn(() => () => {}),
    onMessage: jest.fn(() => () => {}),
    setAutoInitEnabled: jest.fn(async () => {}),
    deleteToken: jest.fn(async () => {
      current = 'fcm_token_NEWNEWNEWNEWNEWNEWNEWNEWNEWN'; // 무효화 뒤에는 새 토큰
    }),
  };
  const source = createFcmTokenSourceFrom(mod as never)!;
  return {
    mod,
    source,
    /** FCM 이 토큰을 바꿨을 때(onTokenRefresh) */
    rotate(next: string) {
      current = next;
      refreshers.forEach(f => f(next));
    },
    subscribers: () => refreshers.length,
  };
}

const setAndroid = (Version: number) => {
  Object.defineProperty(RN.Platform, 'OS', {value: 'android', configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
};
const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};

beforeEach(() => {
  setPushTokenStoreForTest(memoryStore());
  setPushDepsForTest(null);
});
afterEach(() => {
  setTokenSourceForTest(null);
  setPushDevice(null);
  setSettleMsForTest(null);
  setPushTokenStoreForTest(null);
  Object.defineProperty(RN.Platform, 'OS', {value: orig.OS, configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: orig.Version, configurable: true, writable: true});
  jest.restoreAllMocks();
});

describe('토큰 등록·갱신(PushHost)', () => {
  test('권한이 허용된 기기: 역할이 정해지면 FCM 토큰을 받아(자동 초기화 켬) 등록하고, 성공한 토큰만 기기에 둔다', async () => {
    setAndroid(34);
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi({linked: true, consented: true});
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => expect(reg).toHaveBeenCalledWith(TOKEN_A));
    expect(fcm.mod.setAutoInitEnabled).toHaveBeenCalledWith(expect.anything(), true);
    await waitFor(async () => expect(await readPushToken()).toBe(TOKEN_A));
  });

  test('FCM 이 토큰을 바꾸면(onTokenRefresh) 새 토큰을 다시 등록하고 기기 기억도 바꾼다(로그아웃 때 새 토큰을 해제)', async () => {
    setAndroid(34);
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi({linked: true, consented: true});
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(async () => expect(await readPushToken()).toBe(TOKEN_A));
    expect(fcm.subscribers()).toBeGreaterThan(0);
    fcm.rotate(TOKEN_B);
    await waitFor(() => expect(reg).toHaveBeenLastCalledWith(TOKEN_B));
    await waitFor(async () => expect(await readPushToken()).toBe(TOKEN_B));
  });

  test('권한 거부 기기: 토큰을 요청하지 않는다 — 자동 초기화·설치 ID 생성도 없음(데이터 보안 양식 15행), 서버 등록 0', async () => {
    setAndroid(34);
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const api = createFakeApi({linked: true, consented: true});
    const reg = jest.spyOn(api, 'registerPushToken');
    const check = RN.PermissionsAndroid.check as jest.Mock;
    render(<AppRoot api={api} role="parent" restore />);
    // 판정 지점(권한 확인)이 실제로 '거부'를 돌려준 뒤에 본다 — 고정 시간만 기다리면 늦게 부르는 회귀를 놓친다(#262 리뷰)
    await waitFor(() => expect(check).toHaveBeenCalled());
    await settle();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(fcm.mod.setAutoInitEnabled).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
    // 거부 상태에서 토큰이 바뀌었다는 신호가 와도 등록하지 않는다(갱신도 권한을 다시 확인)
    const before = check.mock.calls.length;
    fcm.rotate(TOKEN_B);
    await waitFor(() => expect(check.mock.calls.length).toBeGreaterThan(before));
    await settle();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
  });

  test('역할을 고르기 전(첫 화면)에는 권한이 있어도 토큰을 요청하지 않는다', async () => {
    setAndroid(34);
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi();
    const reg = jest.spyOn(api, 'registerPushToken');
    const check = RN.PermissionsAndroid.check as jest.Mock;
    render(<AppRoot api={api} />);
    await settle();
    expect(check).not.toHaveBeenCalled(); // 등록 판정 자체가 시작되지 않는다(역할 관문)
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
  });
});

describe('앱 안 끄기·켜기(P13·C7 → set_push_enabled)', () => {
  test('끄기: 서버 받기만 끄고(발송 대상 아님) 토큰을 새로 요청·등록하지 않는다', async () => {
    const fcm = fakeMessaging();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true});
    const en = jest.spyOn(api, 'setPushEnabled');
    const reg = jest.spyOn(api, 'registerPushToken');
    const permission = jest.fn(async () => 'granted' as const);
    const r = await setReceive({api, source: fcm.source, store: memoryStore()}, false, permission);
    expect(r).toEqual({ok: true, enabled: false});
    expect(en).toHaveBeenCalledWith(false);
    expect(permission).not.toHaveBeenCalled();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
    expect((await api.myPushSettings()).enabled).toBe(false);
  });

  test('켜기·자녀 알림 켜기: 권한이 거부면 받기 동의만 남고 토큰은 요청하지 않는다, 허용이면 FCM 토큰 등록', async () => {
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
    const reg = jest.spyOn(api, 'registerPushToken');
    const denied = fakeMessaging();
    expect(await setReceive({api, source: denied.source, store: memoryStore()}, true, async () => 'denied')).toEqual({ok: true, enabled: true});
    expect(denied.mod.getToken).not.toHaveBeenCalled();
    expect(await childOptIn({api, source: denied.source, store: memoryStore()}, async () => 'blocked')).toBe(true);
    expect(denied.mod.getToken).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
    const granted = fakeMessaging();
    await setReceive({api, source: granted.source, store: memoryStore()}, true, async () => 'granted');
    expect(reg).toHaveBeenCalledWith(TOKEN_A);
  });
});

describe('로그아웃·계정 삭제 때 토큰 정리(realApi, 0032)', () => {
  const authSignOut = jest.fn(() => Promise.resolve({error: null}));
  function sbWith(rpc: jest.Mock) {
    const sb = {rpc, auth: {getSession: jest.fn(() => Promise.resolve({data: {session: null}, error: null})), signOut: authSignOut}};
    return sb as never;
  }
  const social = {init: jest.fn(), kakao: jest.fn(), google: jest.fn(), signOut: jest.fn(() => Promise.resolve()), unlinkKakao: jest.fn()};

  test('등록한 FCM 토큰(갱신 뒤 최신)을 로그아웃 때 unregister_push_token 으로 해제하고 기기 기억을 지운다', async () => {
    setAndroid(34);
    const calls: [string, unknown][] = [];
    const rpc = jest.fn((name: string, args: unknown) => {
      calls.push([name, args]);
      return Promise.resolve({data: {ok: true}, error: null});
    });
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    const deps = {api, source: fcm.source, store: memoryStore()};
    expect(await registerToken(deps)).toBe('ok');
    fcm.rotate(TOKEN_B);
    expect(await registerToken(deps)).toBe('ok');
    expect(calls.filter(c => c[0] === 'register_push_token').map(c => c[1])).toEqual([
      {p_token: TOKEN_A, p_platform: 'android'},
      {p_token: TOKEN_B, p_platform: 'android'},
    ]);
    await api.signOut();
    expect(calls.filter(c => c[0] === 'unregister_push_token').map(c => c[1])).toEqual([{p_token: TOKEN_B}]);
    expect(await readPushToken()).toBeNull();
  });

  test('#262 리뷰: 등록이 진행 중일 때 로그아웃하면 그 등록이 끝나기를 기다렸다가 해제한다(해제 뒤 다시 기억되지 않음)', async () => {
    setAndroid(34);
    const order: string[] = [];
    let releaseRegister: () => void = () => {};
    const rpc = jest.fn((name: string) => {
      order.push(name);
      if (name === 'register_push_token') {
        return new Promise(r => {
          releaseRegister = () => r({data: {ok: true}, error: null});
        });
      }
      return Promise.resolve({data: {ok: true}, error: null});
    });
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    const reg = registerToken({api, source: fcm.source, store: memoryStore()});
    await waitFor(() => expect(order).toContain('register_push_token'));
    const out = api.signOut();
    await settle();
    expect(order).not.toContain('unregister_push_token'); // 등록이 끝나기 전에는 해제·지우기를 하지 않는다
    releaseRegister();
    expect(await reg).toBe('stale'); // 서버 등록은 됐지만 로그아웃 정리와 겹쳐 기억하지 않고 정리에 넘김
    await out;
    expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: TOKEN_A});
    expect(await readPushToken()).toBeNull();
  });

  test('QA-3 M1: 등록이 기다림 시간을 넘기면 — 기기 토큰을 읽어 해제하고 기기 토큰을 무효화(deleteToken), 늦게 끝난 등록은 기억에 쓰지 않는다', async () => {
    setAndroid(34);
    setSettleMsForTest(30);
    let releaseRegister: () => void = () => {};
    const rpc = jest.fn((name: string) =>
      name === 'register_push_token'
        ? new Promise(r => {
            releaseRegister = () => r({data: {ok: true}, error: null});
          })
        : Promise.resolve({data: {ok: true}, error: null}),
    );
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    setPushDevice(fcm.source);
    const reg = registerToken({api, source: fcm.source, store: memoryStore()});
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('register_push_token', expect.anything()));
    try {
      await api.signOut(); // 등록은 아직 안 끝남(30ms 기다림을 넘김)
      expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: TOKEN_A}); // 기억이 비어 기기 토큰으로
      expect(fcm.mod.deleteToken).toHaveBeenCalledTimes(1);
    } finally {
      releaseRegister(); // 실패해도 묶인 등록을 풀어 다음 시험의 로그아웃이 기다리지 않게
    }
    expect(await reg).toBe('stale');
    expect(await readPushToken()).toBeNull(); // 늦은 등록이 다시 쓰지 못함
  });

  test('QA-3 M1: 해제가 실패하면(서버 오류·끊김) 기기 토큰을 무효화하고 기억을 지운다. 해제가 성공하면 무효화하지 않는다', async () => {
    setAndroid(34);
    for (const fail of ['error', 'throw', null] as const) {
      const rpc = jest.fn((name: string) => {
        if (name === 'unregister_push_token' && fail === 'throw') {
          return Promise.reject(new Error('offline'));
        }
        if (name === 'unregister_push_token' && fail === 'error') {
          return Promise.resolve({data: null, error: {message: 'boom'}});
        }
        return Promise.resolve({data: {ok: true}, error: null});
      });
      const api = createRealApi(sbWith(rpc), social as never);
      const fcm = fakeMessaging();
      setPushDevice(fcm.source);
      expect(await registerToken({api, source: fcm.source, store: memoryStore()})).toBe('ok');
      await api.signOut();
      expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: TOKEN_A});
      expect(fcm.mod.deleteToken).toHaveBeenCalledTimes(fail ? 1 : 0);
      expect(fcm.mod.getToken).toHaveBeenCalledTimes(1); // 기억이 있으면 기기 토큰을 다시 읽지 않는다
      expect(await readPushToken()).toBeNull();
    }
  });

  test('QA-3 M1: 등록한 적 없는 기기(권한 거부 등)는 로그아웃 때 토큰을 만들지도 지우지도 않는다', async () => {
    const rpc = jest.fn(() => Promise.resolve({data: {ok: true}, error: null}));
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    setPushDevice(fcm.source);
    await api.signOut();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(fcm.mod.deleteToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith('unregister_push_token', expect.anything());
  });

  test('QA-1 M1: 끝나지 않는 등록이 있어도 로그아웃은 SETTLE_MS(5초) 뒤 끝나고 세션을 지운다(가짜 시계)', async () => {
    jest.useFakeTimers();
    try {
      setAndroid(34);
      const rpc = jest.fn((name: string) =>
        name === 'register_push_token' ? new Promise(() => {}) : Promise.resolve({data: {ok: true}, error: null}),
      );
      const api = createRealApi(sbWith(rpc), social as never);
      const fcm = fakeMessaging();
      setPushDevice(fcm.source);
      registerToken({api, source: fcm.source, store: memoryStore()});
      await jest.advanceTimersByTimeAsync(0);
      expect(rpc).toHaveBeenCalledWith('register_push_token', expect.anything());
      let done = false;
      const out = api.signOut().then(() => {
        done = true;
      });
      await jest.advanceTimersByTimeAsync(SETTLE_MS - 1);
      expect(done).toBe(false);
      expect(authSignOut).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await out;
      expect(done).toBe(true);
      expect(authSignOut).toHaveBeenCalledWith({scope: 'local'});
      expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: TOKEN_A});
      expect(fcm.mod.deleteToken).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('QA-3 재확인 L1: getToken 이 기다림 시간을 넘기고 로그아웃 정리가 시작된 뒤 끝나면 서버에 등록하지 않는다', async () => {
    setAndroid(34);
    setSettleMsForTest(30);
    const rpc = jest.fn(() => Promise.resolve({data: {ok: true}, error: null}));
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    let releaseToken: (t: string) => void = () => {};
    fcm.mod.getToken.mockImplementationOnce(
      () =>
        new Promise<string>(r => {
          releaseToken = r;
        }),
    );
    setPushDevice(fcm.source);
    const reg = registerToken({api, source: fcm.source, store: memoryStore()});
    await waitFor(() => expect(fcm.mod.getToken).toHaveBeenCalledTimes(1));
    const out = api.signOut(); // 30ms 기다림을 넘김 → 기기 토큰을 읽어 해제·무효화
    try {
      await waitFor(() => expect(fcm.mod.deleteToken).toHaveBeenCalledTimes(1));
    } finally {
      releaseToken(TOKEN_A); // 정리 중에 늦게 도착한 토큰
    }
    expect(await reg).toBe('stale');
    await out;
    expect(rpc).not.toHaveBeenCalledWith('register_push_token', expect.anything());
    expect(await readPushToken()).toBeNull();
  });

  test('QA-1 L2: 로그아웃 중에 새로 시작한 등록은 서버를 부르지 않고, 로그아웃이 끝나면 다시 등록한다', async () => {
    setAndroid(34);
    let releaseUnregister: () => void = () => {};
    const rpc = jest.fn((name: string) =>
      name === 'unregister_push_token'
        ? new Promise(r => {
            releaseUnregister = () => r({data: {ok: true}, error: null});
          })
        : Promise.resolve({data: {ok: true}, error: null}),
    );
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    setPushDevice(fcm.source);
    const deps = {api, source: fcm.source, store: memoryStore()};
    expect(await registerToken(deps)).toBe('ok');
    const out = api.signOut();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: TOKEN_A}));
    const count = () => rpc.mock.calls.filter(c => c[0] === 'register_push_token').length;
    const before = count();
    expect(await registerToken(deps)).toBe('stale'); // 앱이 앞으로 옴·토큰 갱신이 로그아웃 사이에 와도
    expect(count()).toBe(before);
    releaseUnregister();
    await out;
    expect(await readPushToken()).toBeNull();
    expect(await registerToken(deps)).toBe('ok'); // 로그아웃이 끝난 뒤(다음 계정)에는 다시
  });

  test('계정 삭제: 서버가 토큰 행을 함께 지우므로(0032) 해제 호출 없이 기기 기억만 지운다', async () => {
    setAndroid(34);
    const rpc = jest.fn((name: string) =>
      Promise.resolve({data: name === 'delete_my_account' ? {scope: 'none'} : {ok: true}, error: null}),
    );
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    expect(await registerToken({api, source: fcm.source, store: memoryStore()})).toBe('ok');
    expect(await readPushToken()).toBe(TOKEN_A);
    await api.deleteMyAccount();
    expect(rpc).not.toHaveBeenCalledWith('unregister_push_token', expect.anything());
    expect(await readPushToken()).toBeNull();
  });
});

describe('앱이 뒤에 있을 때(머리 없는 작업, #262 리뷰)', () => {
  test('메시징 모듈이 있으면 빈 백그라운드 처리기를 등록하고 토큰은 요청하지 않는다. 모듈·Firebase 앱이 없으면 아무것도 안 함', async () => {
    const fcm = fakeMessaging();
    const set = jest.fn();
    expect(registerBackgroundHandler({...fcm.mod, setBackgroundMessageHandler: set} as never)).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    await expect(set.mock.calls[0][1]({data: {kind: 'daily'}})).resolves.toBeUndefined();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(fcm.mod.setAutoInitEnabled).not.toHaveBeenCalled();
    expect(registerBackgroundHandler(null)).toBe(false);
    const noApp = {
      ...fcm.mod,
      setBackgroundMessageHandler: set,
      getMessaging: () => {
        throw new Error('No Firebase App');
      },
    };
    expect(registerBackgroundHandler(noApp as never)).toBe(false);
    // 기본값(jest 전역 모의 = Firebase 앱 없음)도 조용히 false
    expect(registerBackgroundHandler()).toBe(false);
  });
});
