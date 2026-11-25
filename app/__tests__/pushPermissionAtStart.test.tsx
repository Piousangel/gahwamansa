// 알림 권한 앞당김(기획 v2.1 0.4 · 성장 리뷰 2.3, push/permission-at-start): 시작 단계에서 '우리 말 한 장 → 시스템 창'.
// - 어르신: P2(동의) 직후 코스 홈의 N1(#284) — 순서(동의 → N1 → 시스템 창)와 '동의 전 getToken 0회'를 고정한다.
// - 자녀: 번호를 보낸(공유·복사) 직후, 또는 연결 직후 화면에서 자녀용 한 장(child-notify) → 시스템 창(13+).
//   거절('안 받을게요')·뒤로(오늘은 넘김)는 기존 저장 키(push_prompt_v1·push_prompt_skip_day_v1)를 그대로 써서 다시 묻지 않는다.
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {copy, withTitle} from '../src/copy/copy';
import {createFakeTokenSource, setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {setPushTokenStoreForTest} from '../src/lib/pushToken';
import {press, toHome} from '../testUtils/flow';
import * as clipboard from '../src/ui/clipboard';

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
/** 깨어남(설정·연결 확인) 흉내용 AppState 구독 가로채기. remove 는 실제로 구독을 뗀다(#296 QA-2 L1 — 언마운트 뒤 호출 0 고정) */
function captureAppState() {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((type: string, h: (s: string) => void) => {
    if (type === 'change') {
      handlers.push(h);
    }
    return {
      remove: () => {
        const i = handlers.indexOf(h);
        if (i >= 0) {
          handlers.splice(i, 1);
        }
      },
    };
  }) as never);
  /** act 없이 바로 알림(다른 목 안에서 부를 때) */
  const emit = (state: string) => handlers.slice().forEach(h => h(state));
  const fire = (state: string = 'active') =>
    act(async () => {
      emit(state);
    });
  return Object.assign(fire, {emit, count: () => handlers.length});
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

// #293 QA-2 후속(대기열 60): L2 복사 경로는 바로 묻지 않는다 · L3 열린 채 연결되면 제목을 연결된 상태로
describe('자녀 한 장 — QA-2 후속', () => {
  const copyCode = () =>
    act(async () => {
      fireEvent.press(screen.getAllByTestId('wait-copy')[0]);
    });

  test('L2 복사: 바로 뜨지 않고(복사했어요 띠가 보임) 메신저에 다녀와(앱 복귀) 돌아왔을 때 한 번', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    const app = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await copyCode();
    await settle();
    expect(screen.getByTestId('wait-copied')).toBeTruthy();
    expect(screen.queryByTestId('child-notify')).toBeNull(); // 복사 직후에는 묻지 않는다
    await app('active'); // 앱을 떠나지 않은 active 만으로는 묻지 않는다
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
    await app('background'); // 메신저로 감
    await app('active'); // 돌아옴
    await waitFor(() => screen.getByTestId('child-notify'));
    expect(screen.getByText(withTitle(cp.title_wait, '엄마'), {normalizer: wj})).toBeTruthy();
    expect(getToken).not.toHaveBeenCalled(); // 받기 동의 전 0회
    await app('background'); // 한 화면에서 한 번 — 또 다녀와도 다시 열지 않는다
    act(() => screen.UNSAFE_getByType(RN.Modal).props.onRequestClose());
    await waitFor(() => expect(screen.queryByTestId('child-notify')).toBeNull());
    await app('active');
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
  });

  test('L2 복사하지 않고 앱을 나갔다 오면 묻지 않는다(복사·공유가 계기일 때만)', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    const app = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await app('background');
    await app('active');
    await settle();
    expect(screen.queryByTestId('child-notify')).toBeNull();
  });

  test('L2 복사하고 나간 사이 연결됐다면 돌아왔을 때 연결 직후 제목으로 한 번', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    const app = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await copyCode();
    await app('background');
    await api.redeemInviteCode('123456');
    await app('active');
    await waitFor(() => screen.getByText(copy.connect_done.title, {normalizer: wj}));
    await waitFor(() => screen.getByText(withTitle(cp.title_done, '엄마'), {normalizer: wj}));
    expect(screen.getAllByTestId('child-notify')).toHaveLength(1);
  });

  test('L3 한 장이 열린 채 연결되면 제목이 연결 직후 것으로 바뀐다(한 장은 하나 그대로, 바뀐 제목을 한 번 읽어 줌)', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const source = createFakeTokenSource();
    const getToken = jest.spyOn(source, 'getToken');
    setTokenSourceForTest(source);
    mockShare();
    const announce = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    const wake = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const setPushEnabled = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await waitFor(() => screen.getByText(withTitle(cp.title_wait, '엄마'), {normalizer: wj}));
    await api.redeemInviteCode('123456');
    await wake();
    await waitFor(() => screen.getByText(copy.connect_done.title, {normalizer: wj}));
    await waitFor(() => screen.getByText(withTitle(cp.title_done, '엄마'), {normalizer: wj}));
    expect(screen.queryByText(withTitle(cp.title_wait, '엄마'), {normalizer: wj})).toBeNull();
    expect(screen.getAllByTestId('child-notify')).toHaveLength(1);
    expect(announce.mock.calls.map(c => wj(String(c[0])))).toContain(wj(withTitle(cp.title_done, '엄마')));
    // #296 QA-3 L1: 제목 전환 분기도 받기 동의 전이라 토큰·받기 동의를 건드리지 않는다
    expect(getToken).not.toHaveBeenCalled();
    expect(setPushEnabled).not.toHaveBeenCalled();
  });
});

// #296 QA-2 M1·M2·L1
describe('자녀 한 장 — #296 QA-2 후속', () => {
  const HID = {includeHiddenElements: true};
  const copyCode = () =>
    act(async () => {
      fireEvent.press(screen.getAllByTestId('wait-copy')[0]);
    });

  test('M1 복사 뒤 C3 줄 [알림 켜기]로 직접 켜면 권한 창에서 돌아와도 한 장이 다시 뜨지 않는다(받기 동의 저장이 늦어도)', async () => {
    setPlatform('android', 34);
    setTokenSourceForTest(createFakeTokenSource());
    jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    const app = captureAppState();
    let allowed = false;
    jest.spyOn(RN.PermissionsAndroid, 'check').mockImplementation(async () => allowed);
    jest.spyOn(RN.PermissionsAndroid, 'request').mockImplementation(async () => {
      app.emit('background'); // 권한 창이 앞에 옴
      allowed = true;
      app.emit('active'); // 창이 닫히며 돌아옴 — 권한 결과와 거의 동시
      return 'granted';
    });
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const realEn = api.setPushEnabled.bind(api);
    jest.spyOn(api, 'setPushEnabled').mockImplementation(async (v: boolean) => {
      await new Promise<void>(r => setTimeout(() => r(), 40)); // 실제 망: 받기 동의 저장이 my_push_settings 읽기보다 늦게 끝날 수 있다
      return realEn(v);
    });
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await copyCode();
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('wait-notify')).getByText(wj(copy.child.wait.notify_button), {normalizer: wj}));
    });
    await settle();
    await settle();
    expect(screen.queryByTestId('child-notify', HID)).toBeNull();
  });

  test('M2 복사 → [설정] → 앱 밖 → 복귀: 설정 화면 위에 묻지 않고(판정도 읽지 않음), 그 복귀는 버린다. C3 에서 다시 다녀오면 그때 묻는다', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    const app = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await copyCode();
    await act(async () => {
      fireEvent.press(screen.getByTestId('wait-settings'));
    });
    await settle();
    await app('background');
    await app('active');
    await settle();
    expect(screen.queryByTestId('child-notify', HID)).toBeNull(); // 아래 깔린 C3 의 한 장도 그리지 않는다
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: copy.nav.to.Wait}));
    });
    await settle();
    expect(screen.queryByTestId('child-notify', HID)).toBeNull(); // C3 로 돌아온 것만으로는 묻지 않는다(화면에 들어오자마자 묻지 않음)
    await app('background');
    await app('active');
    await waitFor(() => screen.getByTestId('child-notify'));
  });

  // #296 QA-3 L2: 포커스 검사는 offer 때만 했다 → 판정(my_push_settings 읽기)이 끝나기 전에 [설정]으로 가면 설정 위에 한 장이 떴다
  test('QA-3 L2 판정을 읽는 사이 [설정]으로 가면 설정 화면 위에 한 장을 띄우지 않는다. C3 로 돌아오면 그때 묻는다', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    mockShare();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const realMy = api.myPushSettings.bind(api);
    let release: () => void = () => {};
    const gate = new Promise<void>(r => {
      release = r;
    });
    const my = jest.spyOn(api, 'myPushSettings').mockImplementation(async () => {
      await gate; // 판정 읽기가 늦게 끝난다
      return realMy();
    });
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await shareCode();
    await waitFor(() => expect(my).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByTestId('wait-settings'));
    });
    await settle();
    await act(async () => {
      release();
    });
    await settle();
    expect(screen.queryByTestId('child-notify', HID)).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: copy.nav.to.Wait}));
    });
    await waitFor(() => screen.getByTestId('child-notify'));
    expect(screen.getAllByTestId('child-notify')).toHaveLength(1);
  });

  test('L1 언마운트 뒤에는 C3 의 AppState 구독이 떨어져 복귀해도 판정 읽기 0회', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    setTokenSourceForTest(createFakeTokenSource());
    jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    const app = captureAppState();
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await copyCode();
    await settle();
    expect(app.count()).toBeGreaterThan(0);
    screen.unmount();
    expect(app.count()).toBe(0);
    my.mockClear();
    await app('background');
    await app('active');
    await settle();
    expect(my).not.toHaveBeenCalled();
  });
});
