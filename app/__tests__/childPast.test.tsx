// 버그(PM 감사 C5): 자녀 "지난 답" 탭이 데이터가 있어도 늘 빈 문구를 보여 줬다
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';

const openPast = async () => {
  await waitFor(() => screen.getByText('지난 답'));
  fireEvent.press(screen.getAllByText('지난 답')[0]);
  await waitFor(() => screen.getByTestId('child-past'));
};

test('답이 있으면 지난 답 탭에 질문·고른 답·날짜가 보이고 빈 문구는 없다', async () => {
  const api = createFakeApi({
    consented: true,
    latest: {prompt: '더 좋아하는 계절은요?', choiceLabel: '가을', answeredDate: '2020-11-16'},
  });
  render(<AppRoot api={api} role="child" />);
  await openPast();
  await waitFor(() => screen.getByTestId('child-past-item'));
  expect(screen.getByTestId('child-past-item')).toHaveTextContent(/2020년 11월 16일.*더 좋아하는 계절은요\?.*가을/);
  expect(screen.getAllByText('가을').length).toBeGreaterThan(0);
  expect(screen.queryByText('고른 답이 생기면 여기에 보여요')).toBeNull();
});

test('답이 없을 때만 빈 문구, 나누지 않으면 그 안내', async () => {
  const {unmount} = render(<AppRoot api={createFakeApi({consented: true, latest: null})} role="child" />);
  await openPast();
  await waitFor(() => expect(screen.getAllByText('고른 답이 생기면 여기에 보여요').length).toBeGreaterThan(0));
  unmount();
  render(<AppRoot api={createFakeApi({consented: false})} role="child" />);
  await openPast();
  await waitFor(() => expect(screen.getAllByText('답을 나누지 않는 중이에요').length).toBeGreaterThan(0));
});

test('불러오기 실패면 빈 문구가 아니라 오류와 다시 시도', async () => {
  // 홈 탭이 1번 먹고, 지난 답 탭이 다음 실패를 받는다
  render(<AppRoot api={createFakeApi({consented: true, failChildHome: 2})} role="child" />);
  await openPast();
  await waitFor(() => screen.getByTestId('child-past-error'));
  expect(screen.queryByText('고른 답이 생기면 여기에 보여요', {includeHiddenElements: false})).toBeNull();
});
