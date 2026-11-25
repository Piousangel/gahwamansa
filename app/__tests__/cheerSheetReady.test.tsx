// 대기열 46(#269 CI 첫 실행 cheerRequestId 간헐 실패) 재발 검사.
// 자녀 홈은 요약을 받기 전에도 '응원 보내기'를 꺼진 버튼(불러오는 중 이유)으로 그린다. 그래서
// `waitFor(() => getByRole('button', {name: '응원 보내기'}))` 는 꺼진 버튼을 찾고 끝날 수 있고, 그 뒤 누름은 아무 일도 안 해
// 시트 선택지('늘 고마워요')를 못 찾는다. 요약 응답을 늦춰(가짜 시계 300ms) 그 순간을 매번 만든다.
import React from 'react';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {openCheerSheet, press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

setupWarmAppRoot();
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function slowSummaryApi() {
  const api = createFakeApi({consented: true, parentTitle: '엄마'});
  const real = api.fetchChildSummary.bind(api);
  jest.spyOn(api, 'fetchChildSummary').mockImplementation(() => new Promise(r => setTimeout(() => r(real()), 300)));
  return api;
}

test('함정: 이름만 기다리면 불러오는 중의 꺼진 버튼을 찾고 끝나, 누름이 시트를 열지 않는다', async () => {
  render(<AppRoot api={slowSummaryApi()} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  expect(screen.getByRole('button', {name: '응원 보내기'})).toBeDisabled();
  await press('응원 보내기');
  expect(screen.queryByRole('button', {name: '늘 고마워요'})).toBeNull();
});

test('openCheerSheet: 버튼이 켜질 때까지 기다렸다 눌러 시트 선택지가 보인다', async () => {
  render(<AppRoot api={slowSummaryApi()} role="child" />);
  await openCheerSheet();
  expect(screen.getByRole('button', {name: '늘 고마워요'})).toBeTruthy();
});
