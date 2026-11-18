// 법률 Q4: P13 '문의하기'에서 열람·정정·삭제 요청 경로(메일 + 제목), 주소가 없으면 행은 보이되 안내.
import React from 'react';
import {Linking} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press} from '../testUtils/flow';

let mockMail: string | null = null;
jest.mock('../src/lib/appInfo', () => {
  const actual = jest.requireActual('../src/lib/appInfo');
  return {
    ...actual,
    get CONTACT_EMAIL() {
      return mockMail;
    },
  };
});
afterEach(() => {
  mockMail = null;
  jest.restoreAllMocks();
});

async function settings() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  return waitFor(() => screen.getByTestId('settings-row-contact'));
}

test('주소가 아직 없으면 행은 보이되 누를 수 없고 "준비하고 있어요"와 요청 안내 한 줄', async () => {
  const row = await settings();
  expect(within(row).getByText(/문의 메일 주소를 준비하고 있어요/)).toBeTruthy();
  expect(within(row).getByText(/내 정보를 보거나 고치거나 지우고 싶을 때도/)).toBeTruthy();
  expect(screen.queryByRole('button', {name: /문의하기/})).toBeNull();
});

test('주소가 있으면 누를 때 메일 앱을 제목 "[가화만사성] 내 정보 보기·지우기 요청"으로 연다', async () => {
  mockMail = 'help@example.test';
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  const row = await settings();
  expect(within(row).getByText(/help@example\.test/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(row);
  });
  expect(open).toHaveBeenCalledWith(`mailto:help@example.test?subject=${encodeURIComponent('[가화만사성] 내 정보 보기·지우기 요청')}`);
});
