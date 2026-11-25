// 내부 테스트 N1 '푸시 살리기'(FCM_WIRED 켬): real 모드가 FCM 토큰을 실제로 등록·갱신·정리하는 경로.
// FCM 모듈은 가짜(createFcmTokenSourceFrom)로, 앱 조립은 PushHost(AppRoot) 그대로. 서버 계약: dev-server-notes 2절(0032·0036·0037).
import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {createFcmTokenSourceFrom, FCM_WIRED} from '../src/push/fcmTokenSource';
import {registerToken, setReceive, childOptIn} from '../src/push/pushClient';
import {setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {readPushToken, setPushTokenStoreForTest} from '../src/lib/pushToken';

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
  setPushTokenStoreForTest(null);
  Object.defineProperty(RN.Platform, 'OS', {value: orig.OS, configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: orig.Version, configurable: true, writable: true});
  jest.restoreAllMocks();
});

describe('FCM_WIRED 켬(리뷰 M1 조건 충족: P13 NotifyRows·C7 FamilyPushRow 가 main 에 있음)', () => {
  test('real 모드는 Firebase 모듈이 있으면 FCM 공급자, fake 모드는 그대로 가짜', () => {
    expect(FCM_WIRED).toBe(true);
    // 모듈이 있는 빌드(google-services.json 있음). 같은 파일 안에서 doMock 은 모듈 모의 등록부에 남으므로(isolateModules 로도 안 갈림)
    // '모듈은 있지만 Firebase 앱이 없는 빌드 → 토큰 없음'은 fcmTokenSource.test(전역 모의 그대로)가 본다. 이 파일의 다른 시험은 공급자를 직접 넣는다
    jest.isolateModules(() => {
      jest.doMock('@react-native-firebase/messaging', () => fakeMessaging().mod);
      const ts: typeof import('../src/push/tokenSource') = require('../src/push/tokenSource');
      expect(ts.pickTokenSource('real').kind).toBe('fcm');
      expect(ts.pickTokenSource('fake').kind).toBe('fake');
    });
  });
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
    const tag = jest.spyOn(api, 'accountTag');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => expect(tag).toHaveBeenCalled()); // 조립이 돌았다(retryPending)
    await settle();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    expect(fcm.mod.setAutoInitEnabled).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
    // 거부 상태에서 토큰이 바뀌었다는 신호가 와도 등록하지 않는다
    fcm.rotate(TOKEN_B);
    await settle();
    expect(reg).not.toHaveBeenCalled();
  });

  test('역할을 고르기 전(첫 화면)에는 권한이 있어도 토큰을 요청하지 않는다', async () => {
    setAndroid(34);
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi();
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} />);
    await settle();
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
  function sbWith(rpc: jest.Mock) {
    const signOut = jest.fn(() => Promise.resolve({error: null}));
    const sb = {rpc, auth: {getSession: jest.fn(() => Promise.resolve({data: {session: null}, error: null})), signOut}};
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

  test('계정 삭제: 서버가 토큰 행을 함께 지우므로(0032) 해제 호출 없이 기기 기억만 지운다', async () => {
    setAndroid(34);
    const rpc = jest.fn((name: string) =>
      Promise.resolve({data: name === 'delete_my_account' ? {scope: 'none'} : {ok: true}, error: null}),
    );
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    expect(await registerToken({api, source: fcm.source, store: memoryStore()})).toBe('ok');
    expect(await readPushToken()).toBe(TOKEN_A);
    await api.deleteMyAccount().catch(() => {}); // 기기 정리 일부(소셜 SDK)는 모의 밖 — 토큰 기억만 본다
    expect(rpc).not.toHaveBeenCalledWith('unregister_push_token', expect.anything());
    expect(await readPushToken()).toBeNull();
  });
});
