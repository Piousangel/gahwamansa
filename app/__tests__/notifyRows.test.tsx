// P13 알림 행(시안 P13_more v2, 법률 규칙 ③: 앱 안에서 알림 끄기 — Firebase 연결 전 선행). 켬/끔 = set_push_enabled.
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

test('오늘의 사진·응원 두 행이 켜짐, 누르면 set_push_enabled(false) — 서버 값 하나라 두 행이 함께 꺼짐', async () => {
  const api = await settings();
  const set = jest.spyOn(api, 'setPushEnabled');
  const daily = await waitFor(() => screen.getByRole('switch', {name: '오늘의 사진'}));
  expect(daily.props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole('switch', {name: '응원'}).props.accessibilityState.checked).toBe(true);
  await act(async () => {
    fireEvent.press(daily);
  });
  expect(set).toHaveBeenCalledWith(false);
  await waitFor(() => expect(screen.getByRole('switch', {name: '응원'}).props.accessibilityState.checked).toBe(false));
  await act(async () => {
    fireEvent.press(screen.getByRole('switch', {name: '응원'}));
  });
  expect(set).toHaveBeenLastCalledWith(true);
});

test('끄기에 실패하면 원래 값으로 돌아간다', async () => {
  const api = await settings();
  jest.spyOn(api, 'setPushEnabled').mockRejectedValueOnce(new Error('x'));
  const daily = await waitFor(() => screen.getByRole('switch', {name: '오늘의 사진'}));
  await act(async () => {
    fireEvent.press(daily);
  });
  await waitFor(() => expect(screen.getByRole('switch', {name: '오늘의 사진'}).props.accessibilityState.checked).toBe(true));
});

test('앱 알림이 휴대폰에서 꺼짐: 행 하나 "알림 / 휴대폰 설정에서 꺼져 있어요 / 휴대폰 설정 열기"', async () => {
  jest.spyOn(notify, 'readNotifyPermission').mockResolvedValue('blocked');
  const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
  await settings();
  const row = await waitFor(() => screen.getByTestId('notify-row-system'));
  expect(within(row).getByLabelText('알림, 휴대폰 설정에서 꺼져 있어요')).toBeTruthy();
  expect(screen.queryByRole('switch', {name: '오늘의 사진'})).toBeNull();
  await act(async () => {
    fireEvent.press(within(row).getByRole('button', {name: '휴대폰 설정 열기'}));
  });
  expect(open).toHaveBeenCalledWith();
});

test('응원 채널만 휴대폰에서 꺼짐: 그 행만 안내 + 그 채널 설정 열기', async () => {
  jest.spyOn(notify, 'channelEnabled').mockImplementation(async ch => ch !== 'cheer');
  const open = jest.spyOn(notify, 'openNotifySettings').mockResolvedValue();
  await settings();
  await waitFor(() => screen.getByRole('switch', {name: '오늘의 사진'}));
  const cheer = screen.getByTestId('notify-row-cheer');
  expect(within(cheer).getByLabelText('응원, 휴대폰 설정에서 꺼져 있어요')).toBeTruthy();
  await act(async () => {
    fireEvent.press(within(cheer).getByRole('button', {name: '휴대폰 설정 열기'}));
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
  expect(screen.queryByRole('switch', {name: '오늘의 사진'})).toBeNull();
});
