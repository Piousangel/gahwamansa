// P13 알림 행(법률 규칙 ③: 앱 안에서 알림 끄기 — Firebase 연결 전 선행).
// 빌드 1 결정(리드 11-18): '알림' 한 행, 켬/끔 = set_push_enabled. 휴대폰에서 꺼진 채널은 행 아래 안내 + 휴대폰 설정 열기.
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import * as notify from '../src/push/notifyNative';
import {press} from '../testUtils/flow';
import {copy} from '../src/copy/copy';
import {createFakeTokenSource, FAKE_PUSH_TOKEN, setTokenSourceForTest} from '../src/push/tokenSource';

afterEach(() => jest.restoreAllMocks());

async function settings(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  return api;
}
const sw = () => screen.getByRole('switch', {name: '알림'});

test("'알림' 한 행(켜짐), 누르면 set_push_enabled(false), 다시 누르면 true", async () => {
  const api = await settings();
  const set = jest.spyOn(api, 'setPushEnabled');
  await waitFor(() => expect(sw().props.accessibilityState.checked).toBe(true));
  expect(sw().props.accessibilityHint).toBe('하루 한 번, 오늘 사진이 오면 알려 드려요');
  expect(screen.queryByRole('switch', {name: '오늘의 사진'})).toBeNull();
  await act(async () => {
    fireEvent.press(sw());
  });
  expect(set).toHaveBeenCalledWith(false);
  await waitFor(() => expect(sw().props.accessibilityState).toMatchObject({checked: false, disabled: false})); // 저장 끝(잠금 풀림)
  await act(async () => {
    fireEvent.press(sw());
  });
  expect(set).toHaveBeenLastCalledWith(true);
});

test('끄기에 실패하면 원래 값으로 돌아간다', async () => {
  const api = await settings();
  jest.spyOn(api, 'setPushEnabled').mockRejectedValueOnce(new Error('x'));
  await waitFor(() => sw());
  await act(async () => {
    fireEvent.press(sw());
  });
  await waitFor(() => expect(sw().props.accessibilityState.checked).toBe(true));
  expect(screen.getByTestId('notify-failed')).toBeTruthy(); // 행 아래 한 줄 안내
});

test('앱 알림이 휴대폰에서 꺼짐: 스위치 대신 "알림 / 휴대폰 설정에서 꺼져 있어요 / 휴대폰 설정 열기"', async () => {
  jest.spyOn(notify, 'readNotifyPermission').mockResolvedValue('blocked');
  const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
  await settings();
  const row = await waitFor(() => screen.getByTestId('notify-row-system'));
  expect(within(row).getByLabelText('알림, 휴대폰 설정에서 꺼져 있어요')).toBeTruthy();
  expect(screen.queryByRole('switch', {name: '알림'})).toBeNull();
  await act(async () => {
    fireEvent.press(within(row).getByRole('button', {name: '휴대폰 설정 열기'}));
  });
  expect(open).toHaveBeenCalledWith();
});

test('응원 채널만 휴대폰에서 꺼짐: 행 아래 "응원 알림은 휴대폰 설정에서 꺼져 있어요" + 그 채널 설정 열기', async () => {
  jest.spyOn(notify, 'channelEnabled').mockImplementation(async ch => ch !== 'cheer');
  const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
  await settings();
  const off = await waitFor(() => screen.getByTestId('notify-off'));
  expect(within(off).getByText('응원 알림은 휴대폰 설정에서 꺼져 있어요')).toBeTruthy();
  await act(async () => {
    fireEvent.press(within(off).getByRole('button', {name: '휴대폰 설정 열기'}));
  });
  expect(open).toHaveBeenCalledWith('cheer');
});

test('두 채널 다 꺼짐: ", "로 이은 한 줄 + 앱 알림 화면 열기', async () => {
  jest.spyOn(notify, 'channelEnabled').mockResolvedValue(false);
  const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
  await settings();
  const off = await waitFor(() => screen.getByTestId('notify-off'));
  expect(within(off).getByText('오늘의 사진, 응원 알림은 휴대폰 설정에서 꺼져 있어요')).toBeTruthy();
  await act(async () => {
    fireEvent.press(within(off).getByRole('button', {name: '휴대폰 설정 열기'}));
  });
  expect(open).toHaveBeenCalledWith();
});

test('연결 전 기기(설정 값 없음)는 알림 행이 없다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => screen.getByText('도장 소리'));
  expect(screen.queryByRole('switch', {name: '알림'})).toBeNull();
});

// l2-appinfo 리뷰 M1: Android 13+ 에서 N1 '괜찮아요'로 답한 어르신(권한 = 묻기 전 'denied')도 P13 에서 켤 수 있다.
describe('M1: 권한 denied(다시 물을 수 있음)와 blocked(휴대폰 설정에서만) 분리', () => {
  const RN = require('react-native');
  const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};
  const setPlatform = (OS: string, Version: number) => {
    Object.defineProperty(RN.Platform, 'OS', {value: OS, configurable: true, writable: true});
    Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
  };
  afterEach(() => {
    setPlatform(orig.OS, orig.Version);
    setTokenSourceForTest(null);
  });
  // N1 → 괜찮아요(시스템 창 없음) → 설정
  let n = 0;
  async function declinedThenSettings() {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false); // 13+ 묻기 전 = denied
    setTokenSourceForTest(createFakeTokenSource());
    // N1 기억은 계정별(기기 저장소가 테스트 사이에 남으므로 계정 가명값을 새로)
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, accountTag: `acc-m1-${++n}`});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByLabelText(copy.push.permission.title), {timeout: 8000});
    await press(copy.push.permission.no);
    await waitFor(() => screen.getByTestId('date-line'));
    await press('설정');
    return api;
  }

  test('13+ 묻기 전(denied) + 서버 꺼짐 → 스위치가 보이고, 켜면 set_push_enabled(true) → 권한 창 → 허용이면 토큰 등록', async () => {
    const api = await declinedThenSettings();
    const request = jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('granted');
    const en = jest.spyOn(api, 'setPushEnabled');
    const reg = jest.spyOn(api, 'registerPushToken');
    await waitFor(() => expect(sw().props.accessibilityState.checked).toBe(false));
    expect(screen.queryByTestId('notify-row-system')).toBeNull(); // '휴대폰 설정에서 꺼져 있어요'라는 틀린 안내 없음
    await act(async () => {
      fireEvent.press(sw());
    });
    await waitFor(() => expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN));
    expect(en).toHaveBeenCalledWith(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(en.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]);
    await waitFor(() => expect(sw().props.accessibilityState.checked).toBe(true));
  });

  test('켤 때 권한 창 결과가 blocked(다시 묻지 않음)면 그때만 휴대폰 설정을 연다', async () => {
    await declinedThenSettings();
    jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
    const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
    await waitFor(() => sw());
    await act(async () => {
      fireEvent.press(sw());
    });
    await waitFor(() => expect(open).toHaveBeenCalledWith());
    await waitFor(() => screen.getByTestId('notify-row-system'));
  });
});

test('M1 규칙 화면 확인(리뷰 L9 ③): P13 에서 끄면 다음 실행에 N1 이 다시 뜨지 않는다', async () => {
  const api = createFakeApi({linked: true, consented: true, accountTag: 'acc-l9-off'});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => expect(sw().props.accessibilityState.checked).toBe(true));
  await act(async () => {
    fireEvent.press(sw());
  });
  await waitFor(() => expect(sw().props.accessibilityState).toMatchObject({checked: false, disabled: false}));
  screen.unmount();
  render(<AppRoot api={api} role="parent" restore />); // 서버는 이제 false — 그래도 'off' 기억으로 묻지 않음
  await waitFor(() => screen.getByTestId('date-line'));
  await new Promise<void>(r => setTimeout(() => r(), 300));
  expect(screen.queryByLabelText(copy.push.permission.title)).toBeNull();
});
