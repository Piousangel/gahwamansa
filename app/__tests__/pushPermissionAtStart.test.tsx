// 알림 권한 앞당김(기획 v2.1 0.4 · 성장 리뷰 2.3, push/permission-at-start): 시작 단계에서 '우리 말 한 장 → 시스템 창'.
// - 어르신: P2(동의) 직후 코스 홈의 N1(#284) — 순서(동의 → N1 → 시스템 창)와 '동의 전 getToken 0회'를 고정한다.
// - 자녀: 번호를 보낸(공유·복사) 직후, 또는 연결 직후 화면에서 자녀용 한 장(child-notify) → 시스템 창(13+).
//   거절('안 받을게요')·뒤로(오늘은 넘김)는 기존 저장 키(push_prompt_v1·push_prompt_skip_day_v1)를 그대로 써서 다시 묻지 않는다.
import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {copy, withTitle} from '../src/copy/copy';
import {createFakeTokenSource, setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {setPushTokenStoreForTest} from '../src/lib/pushToken';
import {press, toHome} from '../testUtils/flow';

const RN = require('react-native');
const t = copy.push.permission;
const cp = copy.child.notify_prompt;
const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};
const setPlatform = (OS: string, Version: number) => {
  Object.defineProperty(RN.Platform, 'OS', {value: OS, configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
};
const wj = (x: string) => x.replace(/⁠/g, '').trim();
const settle = () => act(async () => new Promise<void>(r => setTimeout(() => r(), 50)));

beforeEach(() => {
  setPushTokenStoreForTest(memoryStore());
  setPushDepsForTest(null);
});
afterEach(() => {
  setTokenSourceForTest(null);
  setPushTokenStoreForTest(null);
  setPlatform(orig.OS, orig.Version);
  jest.restoreAllMocks();
});

/** 공유 창: 보냄으로 돌아온다 */
function mockShare() {
  return jest.spyOn(RN.Share, 'share').mockResolvedValue({action: RN.Share.sharedAction});
}
/** 깨어남(설정·연결 확인) 흉내용 AppState 구독 가로채기 */
function captureAppState() {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((type: string, h: (s: string) => void) => {
    if (type === 'change') {
      handlers.push(h);
    }
    return {remove: () => {}};
  }) as never);
  return () =>
    act(async () => {
      handlers.forEach(h => h('active'));
    });
}
async function shareCode() {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: copy.child.wait.send}));
  });
}

describe('어르신: P2 직후 N1 → 시스템 창', () => {
  test('순서 — 동의(좋아요) → N1(우리 말) → [알려 주세요] → 받기 동의 → 시스템 창 → 토큰. 답하기 전 getToken 0회', async () => {
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('granted');
    const api = createFakeApi({pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    await toHome(api);
    await waitFor(() => screen.getByTestId('n1'));
    await settle();
    expect(request).not.toHaveBeenCalled(); // 우리 말이 먼저 — 시스템 창은 누른 뒤
    expect(en).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled(); // 받기 동의 전 getToken 0회(대기열 38)
    setPlatform('android', 34); // 시스템 창 경로(화면 글자는 위에서 기본 플랫폼으로 찾음 — 안드로이드는 글자 사이 단어 잇기)
    await press(t.yes);
    await waitFor(() => expect(getToken).toHaveBeenCalledTimes(1));
    expect(en.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]);
    expect(request.mock.invocationCallOrder[0]).toBeLessThan(getToken.mock.invocationCallOrder[0]);
  });

  test("'안 받을게요' — 시스템 창·받기 동의·getToken 모두 0회, 진행(코스 홈)은 그대로", async () => {
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request');
    const api = createFakeApi({pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    await toHome(api);
    await waitFor(() => screen.getByTestId('n1'));
    await press(t.no);
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    await settle();
    expect(request).not.toHaveBeenCalled();
    expect(en).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe('자녀: 시작 단계에서 우리 말 한 장 → 시스템 창', () => {
  test('Android 13+: 번호를 보낸 직후 한 장 → [알림 켜기] → 시스템 창 → 받기 동의 → 토큰. 답하기 전 getToken·받기 동의 0회', async () => {
    setPlatform('android', 34);
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    let allowed = false; // 시스템 창에서 허용하면 그 뒤 권한 읽기도 허용
    jest.spyOn(RN.PermissionsAndroid, 'check').mockImplementation(async () => allowed);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request').mockImplementation(async () => {
      allowed = true;
      return 'granted';
    });
    mockShare();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull(); // 화면에 들어오자마자는 묻지 않는다
    await shareCode();
    await waitFor(() => screen.getByTestId('child-notify'));
    expect(screen.getByText(withTitle(cp.title_wait, '엄마'), {normalizer: wj})).toBeTruthy();
    expect(screen.getByTestId('child-notify-action-hint', {includeHiddenElements: true})).toBeTruthy(); // 13+ 묻기 전: '휴대폰이 한 번 더 물어봐요'
    expect(request).not.toHaveBeenCalled();
    expect(en).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('child-notify-action'));
    });
    await waitFor(() => expect(getToken).toHaveBeenCalledTimes(1));
    expect(request.mock.invocationCallOrder[0]).toBeLessThan(en.mock.invocationCallOrder[0]);
    expect(en).toHaveBeenCalledWith(true);
    await expect(en.mock.results[0].value).resolves.toEqual({ok: true, enabled: true}); // #293 QA-3 L1: 받기 동의 성공 →
    expect(en.mock.invocationCallOrder[0]).toBeLessThan(getToken.mock.invocationCallOrder[0]); // 그 뒤에야 getToken
    await waitFor(() => expect(screen.queryByTestId('child-notify')).toBeNull());
    await waitFor(() => expect(screen.queryByTestId('wait-notify')).toBeNull());
  });

  test('Android 12 이하(권한 창 없음): 한 장은 뜨고(받기 동의가 필요), 미리 알림 줄 없음 — 켜면 창·설정 없이 동의 + 토큰', async () => {
    setPlatform('android', 31);
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request');
    const settings = jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    mockShare();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await settle();
    expect(getToken).not.toHaveBeenCalled(); // 기본 허용 기기라도 동의 전 0회
    await shareCode();
    await waitFor(() => screen.getByTestId('child-notify'));
    await settle();
    expect(getToken).not.toHaveBeenCalled(); // #293 QA-3 L1: 한 장이 뜬 직후에도 0회(답하기 전)
    expect(en).not.toHaveBeenCalled();
    expect(screen.queryByTestId('child-notify-action-hint', {includeHiddenElements: true})).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('child-notify-action'));
    });
    await waitFor(() => expect(getToken).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
    expect(settings).not.toHaveBeenCalled();
    // 재실행: 켠 사람(서버 받는 중)에게는 다시 묻지 않는다
    screen.unmount();
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
  });

  test("'안 받을게요': 아무것도 요청하지 않고, 다시 실행해 번호를 또 보내도 묻지 않는다 — 켜는 줄(C3)은 남는다", async () => {
    setPlatform('android', 34);
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request');
    mockShare();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    const first = render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await waitFor(() => screen.getByTestId('child-notify'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('child-notify-dismiss'));
    });
    await waitFor(() => expect(screen.queryByTestId('child-notify')).toBeNull());
    expect(screen.getByTestId('wait-notify')).toBeTruthy(); // 나중에 켜는 길
    first.unmount();
    // 재실행(같은 기기 저장소)
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(en).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  test('뒤로(답 없이 닫음) = 오늘은 넘김 — 같은 날 연결 직후 화면에서도 다시 묻지 않는다', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    mockShare();
    const wake = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await waitFor(() => screen.getByTestId('child-notify'));
    act(() => screen.UNSAFE_getByType(RN.Modal).props.onRequestClose());
    await waitFor(() => expect(screen.queryByTestId('child-notify')).toBeNull());
    await api.redeemInviteCode('123456');
    await wake();
    await waitFor(() => screen.getByText(copy.connect_done.title, {normalizer: wj}));
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
  });

  test('번호를 보내지 않았어도 연결 직후 화면에서 한 번 — 첫 답 알림용 제목', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    const wake = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await api.redeemInviteCode('123456');
    await wake();
    await waitFor(() => screen.getByTestId('child-notify'));
    expect(screen.getByText(withTitle(cp.title_done, '엄마'), {normalizer: wj})).toBeTruthy();
  });

  test('이미 받는 중이면 묻지 않는다', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    mockShare();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: true});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await waitFor(() => expect(my).toHaveBeenCalled());
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
  });

  test('iOS(자녀 iOS 는 1.1, APNs 전): 묻지 않는다', async () => {
    setPlatform('ios', 17);
    mockShare();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
  });
});
