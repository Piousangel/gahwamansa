// AP-06 P13 앱 정보 한 목록(법률 in-app-notices §3, 디자인 판정 M8): 약관·방침(앱 안 웹 useInAppWeb)·오픈소스(Oss)·AI·병원 아님·사업자·문의.
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import * as appLink from '../src/shared/appLink';
import {press} from '../testUtils/flow';

type Info = ReturnType<typeof import('../src/lib/appInfo').readAppInfo>;
let mockInfo: Partial<Info> = {};
jest.mock('../src/lib/appInfo', () => {
  const actual = jest.requireActual('../src/lib/appInfo');
  return {...actual, readAppInfo: () => ({...actual.readAppInfo(), ...mockInfo})};
});
afterEach(() => {
  mockInfo = {};
  jest.restoreAllMocks();
});

async function settings() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => screen.getByTestId('settings-row-oss'));
}
const order = (ids: string[]) => {
  const found = screen.UNSAFE_root.findAll(n => ids.includes(n.props?.testID)).map(n => n.props.testID as string);
  return [...new Set(found)];
};

test('순서: 약관 → 방침 → 오픈소스 → AI → 병원 아님 → 사업자 → 문의하기 → 버전(값이 없어도 숨기지 않음)', async () => {
  await settings();
  const ids = ['settings-row-terms', 'settings-row-privacy', 'settings-row-oss', 'settings-ai-notice', 'settings-not-medical', 'settings-row-business', 'settings-row-contact', 'version-line', 'version-tap'];
  expect(order(ids).filter(x => !x.startsWith('version'))).toEqual(ids.slice(0, 7));
  // 값이 없으면 개발·staging 은 '[설정 필요]'
  expect(within(screen.getByTestId('settings-row-terms')).getByText('[설정 필요]')).toBeTruthy();
  expect(screen.getByText('병원 앱이 아니고, 안부나 안전을 확인하는 서비스가 아니에요')).toBeTruthy();
});

test('오픈소스 라이선스 → Oss 화면', async () => {
  await settings();
  await press('오픈소스 라이선스');
  await waitFor(() => screen.getByText('이 앱을 만드는 데 쓴 공개 소프트웨어예요'));
});

test('약관: 값이 있으면 useInAppWeb 로 열고, 안 닿으면 화면을 열지 않고 한 줄', async () => {
  mockInfo = {termsUrl: 'https://example.test/terms.html'};
  const openWeb = jest.spyOn(appLink, 'openInAppWeb').mockResolvedValueOnce('offline').mockImplementationOnce(async (t, nav) => {
    nav(t);
    return 'opened';
  });
  await settings();
  await press('이용약관');
  await waitFor(() => screen.getByText('인터넷이 연결되면 볼 수 있어요'));
  expect(openWeb).toHaveBeenCalledWith('terms', expect.any(Function), undefined, undefined);
  await press('이용약관');
  await waitFor(() => expect(openWeb).toHaveBeenCalledTimes(2));
});

test('사업자 정보: 네 값이 다 있으면 누를 때 펼친다', async () => {
  mockInfo = {business: {name: '행복가게', ceo: '홍길동', regNo: '123-45-67890', address: '서울'}};
  await settings();
  expect(screen.queryByTestId('settings-business')).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByTestId('settings-row-business'));
  });
  expect(within(screen.getByTestId('settings-business')).getByText('사업자등록번호 123-45-67890')).toBeTruthy();
});
