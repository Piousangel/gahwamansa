// 대기열 38(리드 결정, 서버 0062 #264 뒤): 받기 동의 전에는 FCM getToken 을 부르지 않는다 — Android 12 이하(알림 기본 허용)에서도
// 설치 ID·토큰이 생기지 않게. 법률 #266 확인 사실 (a) 동의 전 getToken 0회 (b) 앱에서 끈 뒤 sync 가 등록을 부르는지 를 고정한다.
// FCM 모듈은 가짜(createFcmTokenSourceFrom), 앱 조립은 PushHost(AppRoot) 그대로.
import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createFcmTokenSourceFrom} from '../src/push/fcmTokenSource';
import {acceptParentPrompt, childOptIn, registerIfConsented, setReceive} from '../src/push/pushClient';
import {setPushReceive} from '../src/push/runtime';
import {setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {readPushToken, setPushDevice, setPushTokenStoreForTest} from '../src/lib/pushToken';
import {createRealApi} from '../src/features/realApi';
import {press} from '../testUtils/flow';

const RN = require('react-native');
const TOKEN_A = 'fcm_token_AAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TOKEN_B = 'fcm_token_BBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const settle = () => act(async () => new Promise<void>(r => setTimeout(() => r(), 50)));

function fakeMessaging() {
  let current = TOKEN_A;
  const refreshers: ((t: string) => void)[] = [];
  const mod = {
    getMessaging: jest.fn(() => ({})),
    getToken: jest.fn(async () => current),
    deleteToken: jest.fn(async () => {}),
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
  return {
    mod,
    source: createFcmTokenSourceFrom(mod as never)!,
    rotate(next: string) {
      current = next;
      refreshers.forEach(f => f(next));
    },
    /** 토큰 요청·설치 ID 를 만들 수 있는 호출 수(getToken·자동 초기화 **켜기**). 끄기(false)는 세지 않는다 */
    tokenCalls: () =>
      mod.getToken.mock.calls.length + mod.setAutoInitEnabled.mock.calls.filter(c => (c as unknown[])[1] === true).length,
  };
}

/** Android 12(API 31): 런타임 알림 권한이 없어 readNotifyPermission 이 늘 'granted'(기본 허용) — 이번 결정이 겨냥한 기기 */
function android12() {
  Object.defineProperty(RN.Platform, 'OS', {value: 'android', configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: 31, configurable: true, writable: true});
  const check = jest.spyOn(RN.PermissionsAndroid, 'check');
  return check;
}
function wakeHandlers() {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((type: string, h: (st: string) => void) => {
    if (type === 'change') {
      handlers.push(h);
    }
    return {remove: jest.fn()};
  }) as never);
  return async () => {
    await act(async () => {
      handlers.forEach(h => h('active'));
    });
  };
}

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

describe('(a) 받기 동의 전 getToken 0회 — Android 12 이하 기본 허용 기기', () => {
  test.each([
    ['어르신(연결됨, 아직 N1 답 없음)', 'parent' as const, {linked: true, consented: true, pushEnabled: false}],
    ['어르신(연결 전)', 'parent' as const, {}],
    ['자녀(알림 켜기 누르기 전)', 'child' as const, {consented: true, parentTitle: '엄마', pushEnabled: false}],
  ])('%s: 앱 시작·앞으로 돌아옴·토큰 갱신 신호 어디서도 토큰을 요청하지 않는다', async (_name, role, opts) => {
    const check = android12();
    const wake = wakeHandlers();
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    const api = createFakeApi(opts);
    const reg = jest.spyOn(api, 'registerPushToken');
    const settings = jest.spyOn(api, 'myPushSettings');
    render(role === 'parent' ? <AppRoot api={api} role="parent" restore /> : <AppRoot api={api} role="child" />);
    await waitFor(() => expect(settings).toHaveBeenCalled()); // 동의 확인까지 갔다(판정 지점)
    await settle();
    await wake();
    await waitFor(() => expect(settings.mock.calls.length).toBeGreaterThan(1));
    fcm.rotate(TOKEN_B); // SDK 가 스스로 토큰을 바꿨다는 신호가 와도
    await waitFor(() => expect(settings.mock.calls.length).toBeGreaterThan(2));
    await settle();
    expect(check).not.toHaveBeenCalled(); // 12 이하는 시스템 권한 창 없음(기본 허용) — 이 경로가 맞는지
    expect(fcm.tokenCalls()).toBe(0);
    expect(reg).not.toHaveBeenCalled();
  });

  test('동의를 확인하지 못하면(오프라인) 토큰을 요청하지 않는다 — 모르면 부르지 않는 쪽', async () => {
    android12();
    const fcm = fakeMessaging();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true});
    jest.spyOn(api, 'myPushSettings').mockRejectedValue(new Error('offline'));
    expect(await registerIfConsented({api, source: fcm.source, store: memoryStore()})).toBe('no_consent');
    expect(fcm.tokenCalls()).toBe(0);
  });

  test('받기 동의를 보내지 못하면(N1 알려 주세요·자녀 알림 켜기가 오프라인) 권한이 허용이어도 토큰을 요청하지 않는다', async () => {
    android12();
    const fcm = fakeMessaging();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
    jest.spyOn(api, 'setPushEnabled').mockRejectedValue(new Error('offline'));
    const deps = {api, source: fcm.source, store: memoryStore()};
    expect(await acceptParentPrompt(deps, async () => 'granted')).toBe('granted');
    expect(await childOptIn(deps, async () => 'granted')).toBe(false);
    expect(fcm.tokenCalls()).toBe(0);
  });
});

describe('동의가 생기는 순간 등록', () => {
  test('N1 알려 주세요·자녀 알림 켜기·P13 켜기: set_push_enabled(true) 성공 직후 토큰 등록', async () => {
    android12();
    for (const run of [
      (d: Parameters<typeof acceptParentPrompt>[0]) => acceptParentPrompt(d, async () => 'granted'),
      (d: Parameters<typeof acceptParentPrompt>[0]) => childOptIn(d, async () => 'granted'),
      (d: Parameters<typeof acceptParentPrompt>[0]) => setReceive(d, true, async () => 'granted'),
    ]) {
      const fcm = fakeMessaging();
      const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
      const order: string[] = [];
      jest.spyOn(api, 'setPushEnabled').mockImplementation(async e => {
        order.push('set_push_enabled');
        return {ok: true, enabled: e};
      });
      jest.spyOn(api, 'registerPushToken').mockImplementation(async () => {
        order.push('register');
        return {ok: true};
      });
      await run({api, source: fcm.source, store: memoryStore()});
      expect(order).toEqual(['set_push_enabled', 'register']);
      expect(fcm.mod.getToken).toHaveBeenCalledTimes(1);
    }
  });

  test('N1 동의를 오프라인으로 못 보냈다가 다음 깨어남에 재시도가 성공하면 그때 등록한다', async () => {
    android12();
    const wake = wakeHandlers();
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
    const reg = jest.spyOn(api, 'registerPushToken');
    const en = jest.spyOn(api, 'setPushEnabled').mockRejectedValueOnce(new Error('offline'));
    // N1 을 오프라인에서 수락(yes_pending) — 화면 대신 같은 저장소로 직접
    const {configurePush} = require('../src/push/runtime');
    const store = memoryStore();
    const deps = configurePush(api, fcm.source);
    deps.store = store;
    await acceptParentPrompt(deps, async () => 'granted');
    expect(fcm.tokenCalls()).toBe(0);
    render(<AppRoot api={api} role="parent" restore />);
    await wake();
    await waitFor(() => expect(en.mock.calls.length).toBeGreaterThanOrEqual(2)); // 재시도(앱 시작·깨어남)
    await waitFor(() => expect(reg).toHaveBeenCalledWith(TOKEN_A));
  });
});

describe('(b) 앱에서 끈 뒤', () => {
  test('끄면 서버 받기가 꺼지고, 그 뒤 앱 시작·깨어남·토큰 갱신의 sync 는 토큰을 요청·등록하지 않는다', async () => {
    android12();
    const wake = wakeHandlers();
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true});
    const reg = jest.spyOn(api, 'registerPushToken');
    const settings = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => expect(reg).toHaveBeenCalledWith(TOKEN_A)); // 켜져 있을 때는 등록
    await waitFor(async () => expect(await readPushToken()).toBe(TOKEN_A));
    const before = fcm.tokenCalls();
    const regBefore = reg.mock.calls.length;
    expect(await setPushReceive(false)).toEqual({ok: true, enabled: false});
    const seen = settings.mock.calls.length;
    await wake();
    await waitFor(() => expect(settings.mock.calls.length).toBeGreaterThan(seen));
    fcm.rotate(TOKEN_B);
    await waitFor(() => expect(settings.mock.calls.length).toBeGreaterThan(seen + 1));
    await settle();
    expect(fcm.tokenCalls()).toBe(before);
    expect(reg.mock.calls.length).toBe(regBefore);
  });
});

describe('리드 결정 11-25: 동의가 없어지면 SDK 자동 초기화도 끔(끄기·로그아웃·계정 삭제), 다시 동의하면 켬', () => {
  const autoInit = (fcm: ReturnType<typeof fakeMessaging>) => fcm.mod.setAutoInitEnabled.mock.calls.map(c => (c as unknown[])[1]);
  const social = {init: jest.fn(), kakao: jest.fn(), google: jest.fn(), signOut: jest.fn(() => Promise.resolve()), unlinkKakao: jest.fn()};
  function sbWith(rpc: jest.Mock) {
    const sb = {
      rpc,
      auth: {getSession: jest.fn(() => Promise.resolve({data: {session: null}, error: null})), signOut: jest.fn(() => Promise.resolve({error: null}))},
    };
    return sb as never;
  }

  test('P13 끄기(setReceive false) → 자동 초기화 false, 다시 켜기 → getToken 이 true', async () => {
    android12();
    const fcm = fakeMessaging();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true});
    const deps = {api, source: fcm.source, store: memoryStore()};
    await setReceive(deps, false, async () => 'granted');
    expect(autoInit(fcm)).toEqual([false]);
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
    await setReceive(deps, true, async () => 'granted');
    expect(autoInit(fcm)).toEqual([false, true]);
    expect(fcm.mod.getToken).toHaveBeenCalledTimes(1);
  });

  test('C7 자녀 토글 끄기 → 자동 초기화 false, 다시 켜기 → true + 등록', async () => {
    Object.defineProperty(RN.Platform, 'OS', {value: 'android', configurable: true, writable: true});
    Object.defineProperty(RN.Platform, 'Version', {value: 34, configurable: true, writable: true});
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    const api = createFakeApi({consented: true, parentTitle: '엄마', childFamily: true}); // 받는 중(기본 켬)
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByRole('switch', {name: '가족 연결'}));
    fcm.mod.setAutoInitEnabled.mockClear();
    fireEvent.press(screen.getByRole('switch', {name: '가족 연결'}));
    await waitFor(() => expect(autoInit(fcm)).toEqual([false]));
    await waitFor(() => expect(screen.getByRole('switch', {name: '가족 연결'}).props.accessibilityState.disabled).toBe(false));
    reg.mockClear();
    fireEvent.press(screen.getByRole('switch', {name: '가족 연결'}));
    await waitFor(() => expect(reg).toHaveBeenCalledWith(TOKEN_A));
    expect(autoInit(fcm)).toEqual([false, true]);
  });

  test('로그아웃 → 자동 초기화 false(정상 해제 경로에서도)', async () => {
    android12();
    const rpc = jest.fn(() => Promise.resolve({data: {ok: true}, error: null}));
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    setPushDevice(fcm.source);
    try {
      await registerIfConsented({api: {...api, myPushSettings: async () => ({enabled: true})}, source: fcm.source, store: memoryStore()});
      expect(autoInit(fcm)).toEqual([true]);
      await api.signOut();
      expect(rpc).toHaveBeenCalledWith('unregister_push_token', {p_token: TOKEN_A});
      expect(fcm.mod.deleteToken).not.toHaveBeenCalled(); // 정상 해제면 토큰은 두고
      expect(autoInit(fcm)).toEqual([true, false]); // 자동 초기화만 끔
    } finally {
      setPushDevice(null);
    }
  });

  test('계정 삭제 → 자동 초기화 false', async () => {
    android12();
    const rpc = jest.fn((name: string) => Promise.resolve({data: name === 'delete_my_account' ? {scope: 'none'} : {ok: true}, error: null}));
    const api = createRealApi(sbWith(rpc), social as never);
    const fcm = fakeMessaging();
    setPushDevice(fcm.source);
    try {
      await api.deleteMyAccount();
      expect(autoInit(fcm)).toEqual([false]);
      expect(fcm.mod.getToken).not.toHaveBeenCalled();
    } finally {
      setPushDevice(null);
    }
  });
});

describe('#269 QA-3 L1: sync 가 남은 자동 초기화 켜짐을 정리', () => {
  test.each([
    ['받기 꺼짐(false) → 자동 초기화 끔', {linked: true, consented: true, pushEnabled: false}, [false]],
    ['연결 전(null) → 자동 초기화 끔', {}, [false]],
    ['받는 중(true) → 끄지 않고 등록(getToken 이 켬)', {linked: true, consented: true, pushEnabled: true}, [true]],
  ])('%s', async (_n, opts, expected) => {
    android12();
    const fcm = fakeMessaging();
    await registerIfConsented({api: createFakeApi(opts), source: fcm.source, store: memoryStore()});
    expect(fcm.mod.setAutoInitEnabled.mock.calls.map(c => (c as unknown[])[1])).toEqual(expected);
  });

  test('오프라인(받기 상태 모름)이면 건드리지 않는다', async () => {
    android12();
    const fcm = fakeMessaging();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
    jest.spyOn(api, 'myPushSettings').mockRejectedValue(new Error('offline'));
    expect(await registerIfConsented({api, source: fcm.source, store: memoryStore()})).toBe('no_consent');
    expect(fcm.mod.setAutoInitEnabled).not.toHaveBeenCalled();
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
  });

  test('앱 시작 sync(PushHost)에서도: 동의 없는 계정이면 자동 초기화를 끈다', async () => {
    android12();
    const fcm = fakeMessaging();
    setTokenSourceForTest(fcm.source);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => expect(fcm.mod.setAutoInitEnabled).toHaveBeenCalledWith(expect.anything(), false));
    expect(fcm.mod.getToken).not.toHaveBeenCalled();
  });
});

test('#269 QA-1 L1: 동의 조회 중에 로그아웃(계정 바뀜)이 끼면 이전 계정의 동의로 토큰을 요청하지 않는다', async () => {
  android12();
  const fcm = fakeMessaging();
  const social = {init: jest.fn(), kakao: jest.fn(), google: jest.fn(), signOut: jest.fn(() => Promise.resolve()), unlinkKakao: jest.fn()};
  const rpc = jest.fn(() => Promise.resolve({data: {ok: true}, error: null}));
  const sb = {
    rpc,
    auth: {getSession: jest.fn(() => Promise.resolve({data: {session: null}, error: null})), signOut: jest.fn(() => Promise.resolve({error: null}))},
  };
  const real = createRealApi(sb as never, social as never);
  let answer: (v: {enabled: boolean | null}) => void = () => {};
  const api = {
    ...real,
    myPushSettings: () =>
      new Promise<{enabled: boolean | null}>(r => {
        answer = r;
      }),
  };
  const pending = registerIfConsented({api, source: fcm.source, store: memoryStore()});
  await real.signOut(); // 조회가 끝나기 전에 로그아웃 정리
  answer({enabled: true}); // 이전 계정은 받는 중이었다
  expect(await pending).toBe('stale');
  expect(fcm.mod.getToken).not.toHaveBeenCalled();
  expect(fcm.mod.setAutoInitEnabled).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalledWith('register_push_token', expect.anything());
});
