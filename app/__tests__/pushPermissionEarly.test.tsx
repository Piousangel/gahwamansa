// H1(오너 11-25, 3일 시나리오 빈틈 1): 알림 묻기를 시작 단계로 — 어르신은 연결(P1c)·동의(P2) 직후 코스 홈에서 N1,
// 자녀는 C3·연결 직후 화면에서 아직 받기 동의(알림 켜기)를 안 했으면 OS 권한이 이미 허용이어도 [알림 켜기]를 보인다.
// 재촉 금지: '안 받을게요'면 다시 묻지 않고, 뒤로(오늘은 넘김)면 다음 날 P7 뒤에만 다시.
import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {copy} from '../src/copy/copy';
import {createFakeTokenSource, FAKE_PUSH_TOKEN, setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {setPushTokenStoreForTest} from '../src/lib/pushToken';
import {navRef} from '../src/navigation/navRef';
import {courseHomeShown, enterCode, press, toHome, toHomeConsented} from '../testUtils/flow';

const RN = require('react-native');
const t = copy.push.permission;
const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};
const setPlatform = (OS: string, Version: number) => {
  Object.defineProperty(RN.Platform, 'OS', {value: OS, configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
};
// Android 에서는 한국어 줄바꿈용 단어 잇기(U+2060)가 글자 사이에 들어간다
const wj = (x: string) => x.replace(/\u2060/g, '').trim();
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

describe('어르신: 연결 직후 N1', () => {
  test('번호 연결 → 답 보여 주기(좋아요) → 코스 홈에 오면 바로 N1 — 알려 주세요 = 받기 동의 + 시스템 창', async () => {
    const api = createFakeApi({pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    await toHome(api);
    await waitFor(() => screen.getByTestId('n1'));
    setPlatform('android', 34); // 시스템 창 경로(화면 글자는 위에서 기본 플랫폼으로 찾음)
    const request = jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('granted');
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    expect(screen.getByText(t.title)).toBeTruthy(); // 기존 N1 문구 그대로('내일 새 사진이 오면 알려 드릴까요?')
    await press(t.yes);
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    expect(en).toHaveBeenCalledWith(true);
    expect(request).toHaveBeenCalled();
  });

  test('답 보여 주기를 거절(싫어요)해도 묻는다 — 알림 받기와 별개 동의(PR #65 L1)', async () => {
    const api = createFakeApi({pushEnabled: false});
    await toHome(api, false);
    await waitFor(() => screen.getByTestId('n1'));
  });

  test('이미 동의한 서버(동의 화면 없이 번호 → 코스 홈)에서도 묻는다', async () => {
    const api = createFakeApi({pushEnabled: false, consented: true});
    await toHomeConsented(api);
    await waitFor(() => screen.getByTestId('n1'));
  });

  test('이미 받는 중(재설치 등)이면 연결 직후에도 묻지 않는다', async () => {
    const api = createFakeApi({pushEnabled: true});
    const my = jest.spyOn(api, 'myPushSettings');
    await toHome(api);
    await waitFor(() => expect(my).toHaveBeenCalled());
    await settle();
    expect(screen.queryByTestId('n1')).toBeNull();
  });

  test("재촉 금지: 연결 직후 '안 받을게요' → 그날 코스를 마치고 P7 뒤에도 다시 묻지 않는다", async () => {
    const api = createFakeApi({pushEnabled: false});
    await toHome(api);
    await waitFor(() => screen.getByTestId('n1'));
    await press(t.no);
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    // P7 → 코스 홈(묻는 두 번째 자리)
    await act(async () => {
      navRef.navigate('CourseDone' as never);
    });
    await act(async () => {
      navRef.navigate('CourseHome' as never);
    });
    await waitFor(courseHomeShown);
    await settle();
    expect(screen.queryByTestId('n1')).toBeNull();
  });

  test('번호만 쓰다 말고(연결 전) 첫 화면으로 돌아가면 묻지 않는다 — 코스 홈에 연결된 채로 들어왔을 때만', async () => {
    const api = createFakeApi({pushEnabled: false});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="parent" />);
    await enterCode('999999', false); // 맞지 않는 번호
    await settle();
    expect(screen.queryByTestId('n1')).toBeNull();
    expect(my).not.toHaveBeenCalled();
  });
});

describe('자녀: 받기 동의 전이면 OS 권한과 상관없이 [알림 켜기]', () => {
  test('Android 12(권한 기본 허용) C3: 줄이 보이고, 누르면 시스템 창·휴대폰 설정 없이 받기 동의 + 토큰 등록, 줄이 사라진다', async () => {
    setPlatform('android', 31);
    setTokenSourceForTest(createFakeTokenSource());
    const request = jest.spyOn(RN.PermissionsAndroid, 'request');
    const settings = jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-notify'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: copy.child.wait.notify_button}));
    });
    await waitFor(() => expect(en).toHaveBeenCalledWith(true));
    await waitFor(() => expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN));
    await waitFor(() => expect(screen.queryByTestId('wait-notify')).toBeNull());
    expect(request).not.toHaveBeenCalled();
    expect(settings).not.toHaveBeenCalled();
  });

  test('이미 받는 중이고 권한도 허용이면 C3 줄을 보이지 않는다(지금과 같음)', async () => {
    setPlatform('android', 31);
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: true});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await waitFor(() => expect(my).toHaveBeenCalled());
    await settle();
    expect(screen.queryByTestId('wait-notify')).toBeNull();
  });

  test('연결 직후 화면: 아직 켜지 않았으면 "알림을 켜면 첫 답이 보일 때 알려 드려요" + [알림 켜기], 켜면 사라진다', async () => {
    setPlatform('android', 31);
    setTokenSourceForTest(createFakeTokenSource());
    const handlers: ((s: string) => void)[] = [];
    jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((type: string, h: (s: string) => void) => {
      if (type === 'change') {
        handlers.push(h);
      }
      return {remove: () => {}};
    }) as never);
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마', pushEnabled: false});
    const en = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'));
    await api.redeemInviteCode('123456'); // 어르신 폰에서 번호 입력
    await act(async () => {
      handlers.forEach(h => h('active'));
    });
    await waitFor(() => screen.getByText(copy.connect_done.title, {normalizer: wj}));
    await waitFor(() => screen.getByTestId('done-notify'));
    expect(screen.getByText('알림을 켜면 첫 답이 보일 때 알려 드려요', {normalizer: wj})).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: copy.child.wait.notify_button}));
    });
    await waitFor(() => expect(en).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByTestId('done-notify')).toBeNull());
  });
});
