// P13 알림 행(법률 규칙 ③: 앱 안에서 알림 끄기 — Firebase 연결 전 선행).
// 빌드 1 결정(리드 11-18): '알림' 한 행, 켬/끔 = set_push_enabled. 휴대폰에서 꺼진 채널은 행 아래 안내 + 휴대폰 설정 열기.
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import * as notify from '../src/push/notifyNative';
import {press} from '../testUtils/flow';

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

test('응원 채널만 휴대폰에서 꺼짐: 행 아래 그 종류 안내 + 그 채널 설정 열기', async () => {
  jest.spyOn(notify, 'channelEnabled').mockImplementation(async ch => ch !== 'cheer');
  const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
  await settings();
  const off = await waitFor(() => screen.getByTestId('notify-off-cheer'));
  expect(screen.queryByTestId('notify-off-daily')).toBeNull();
  expect(within(off).getByLabelText('응원, 휴대폰 설정에서 꺼져 있어요')).toBeTruthy();
  await act(async () => {
    fireEvent.press(within(off).getByRole('button', {name: '휴대폰 설정 열기'}));
  });
  expect(open).toHaveBeenCalledWith('cheer');
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
