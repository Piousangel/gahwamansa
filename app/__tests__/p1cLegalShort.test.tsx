// #274 법률 판정(짧은 고지 구성 충분, 코멘트 7158739909)의 조건 3개를 고정한다.
// ① Dock 짧은 고지의 '약관' 링크는 이용약관을 열고, 읽기 이름은 '이용약관'
// ② 1.6배 이상 본문 긴 문장의 두 링크(이용약관·개인정보 처리방침)가 본문 스크롤 안에 있다(렌더 트리 = 스크롤로 닿음)
// ③ 배율과 상관없이 연결하면 같은 동의 기록(terms_agreements 두 문서 버전) 호출
import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {PRIVACY_VERSION, TERMS_VERSION} from '../src/api/contract/terms';
import {press, typeCode} from '../testUtils/flow';

// 약관 주소가 정해진 빌드(링크가 그려지는 상태)
jest.mock('../src/lib/appInfo', () => ({...jest.requireActual('../src/lib/appInfo'), TERMS_URL: 'https://t.example', PRIVACY_URL: 'https://p.example'}));
const mockOpen = jest.fn(async (_t: string) => 'opened');
jest.mock('../src/shared/useInAppWeb', () => ({
  useInAppWeb: () => ({open: (t: string) => mockOpen(t), busy: null}),
}));
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 320, height: 640, scale: 2.75, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
  mockOpen.mockClear();
  jest.restoreAllMocks();
});

async function p1c(scale: number, api = createFakeApi()) {
  mockFontScale = scale;
  render(<AppRoot api={api} role="parent" />);
  await typeCode('123456');
  await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  return api;
}

test.each([1.6, 2])("① 글자 %s배: Dock 짧은 고지의 '약관' 링크는 읽기 이름 '이용약관'이고 이용약관을 연다", async scale => {
  await p1c(scale);
  const short = within(screen.getByTestId('confirm-legal-dock'));
  expect(screen.getByTestId('legal-short').props.accessibilityLabel).toBe('연결하면 약관에 동의하게 돼요');
  const link = short.getByRole('link');
  expect(link.props.accessibilityLabel).toBe('이용약관');
  expect(screen.getByTestId('legal-short').props.accessibilityActions).toEqual([{name: 'link-0', label: '이용약관'}]);
  fireEvent.press(link);
  expect(mockOpen).toHaveBeenCalledWith('terms');
});

test.each([1.6, 2])('② 글자 %s배: 본문 긴 문장의 두 링크(이용약관·개인정보 처리방침)가 본문 스크롤 안에 있고 각각 연다', async scale => {
  await p1c(scale);
  const body = within(screen.getByTestId('screen-body'));
  const line = body.getByTestId('legal-line');
  expect(line.props.accessibilityLabel).toBe('연결하면 이용약관에 동의하고 개인정보 처리방침을 확인해요');
  const links = within(line).getAllByRole('link');
  expect(links.map(l => l.props.children)).toEqual(['이용약관', '개인정보 처리방침']);
  fireEvent.press(links[0]);
  fireEvent.press(links[1]);
  expect(mockOpen.mock.calls.map(c => c[0])).toEqual(['terms', 'privacy']);
  // 본문 스크롤(screen-body) 안이고 위 고정·Dock 이 아니다
  expect(within(screen.getByTestId('screen-dock')).queryByTestId('legal-line')).toBeNull();
});

test.each([1, 1.5, 1.6, 2])('③ 글자 %s배: 연결하면 같은 동의 기록(이용약관·처리방침 두 버전)', async scale => {
  const api = createFakeApi();
  const rec = jest.spyOn(api, 'recordTermsAgreement');
  await p1c(scale, api);
  await press('이 번호로 연결하기');
  await waitFor(() => expect(rec).toHaveBeenCalledWith(TERMS_VERSION, PRIVACY_VERSION));
  expect(rec).toHaveBeenCalledTimes(1);
});

// 대기열 50: 짧은 고지의 '약관'은 본문 긴 문장의 링크와 같은 모양(굵게 + 밑줄 + 같은 색)이어야 링크로 보인다.
// (캡처에서 둘 다 밑줄이 없던 것은 staging env 에 TERMS_URL·PRIVACY_URL 이 비어 있어서 — 주소가 없으면 누를 수 없으므로
//  일부러 일반 글자로 그린다(LegalText 규칙). 주소가 정해진 빌드에서는 아래처럼 같은 모양이다)
test.each([1.6, 2])("대기열 50 글자 %s배: 짧은 고지 '약관'은 긴 문장 링크와 같은 밑줄·굵기·색", async scale => {
  await p1c(scale);
  const flat = (n: {props: {style?: unknown}}) => StyleSheet.flatten(n.props.style as never) as {textDecorationLine?: string; fontWeight?: string; color?: string};
  const short = flat(within(screen.getByTestId('legal-short')).getByRole('link'));
  const long = flat(within(screen.getByTestId('legal-line')).getAllByRole('link')[0]);
  expect(short.textDecorationLine).toBe('underline');
  expect({deco: short.textDecorationLine, weight: short.fontWeight, color: short.color}).toEqual({deco: long.textDecorationLine, weight: long.fontWeight, color: long.color});
});
