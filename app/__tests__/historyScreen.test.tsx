import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import type {HistoryDay} from '../src/api/contract/history';
import {historyDateLabel} from '../src/features/course/stamps';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

// P15 지난 날(동결 시안 P15_history): 폴라로이드 한 장 = 하루, 최신이 위, 빈 날 없음(달력 금지), 보기만.
const d1: HistoryDay = {
  session_date: '2026-11-19',
  day_index: 3,
  completed: true,
  photo: {caption: '감 익는 마당', image_url: 'https://example.test/3.jpg', keyword: '감나무'},
  question: {prompt: '어느 계절이 더 좋으세요?', option_a: '봄', option_b: '가을'},
  choice_label: '가을',
};
const d2: HistoryDay = {
  ...d1,
  session_date: '2026-11-18',
  day_index: 2,
  photo: {caption: '마을 정자', image_url: 'https://example.test/2.jpg', keyword: '느티나무'},
  question: {prompt: null, option_a: '산', option_b: '바다'},
  choice_label: null, // 보여 주지 않은 날
};

async function home(opts: FakeOptions) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

test('날짜 표기: "11월 19일 목요일"', () => {
  expect(historyDateLabel('2026-11-19')).toBe('11월 19일 목요일');
});

test('코스 홈 날짜 줄 아래 "지난 날 보기" → 목록(제목·보조, 최신이 위, 한 날 = 날짜·고른 답·낱말)', async () => {
  const api = await home({parentDays: [d1, d2]});
  const get = jest.spyOn(api, 'parentHistory');
  await press('지난 날 보기');
  await waitFor(() => screen.getByText('최근 한 달 동안 본 사진이에요'));
  expect(get).toHaveBeenCalledWith(30);
  expect(screen.getByRole('header', {name: '지난 날'})).toBeTruthy();
  const items = screen.getAllByTestId(/^history-item-/);
  expect(items.map(i => i.props.testID)).toEqual(['history-item-2026-11-19', 'history-item-2026-11-18']);
  const first = within(items[0]);
  expect(first.getByText('11월 19일 목요일', {includeHiddenElements: true})).toBeTruthy();
  expect(first.getByText('가을', {includeHiddenElements: true})).toBeTruthy();
  expect(first.getByText('감나무', {includeHiddenElements: true})).toBeTruthy();
  // 보여 주지 않은 날: 고른 답 줄 없음, 문구 없음
  const second = within(items[1]);
  expect(second.queryByText('고른 답', {includeHiddenElements: true})).toBeNull();
  expect(second.getByText('느티나무', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByText(/저장되지 않았|못|아직/)).toBeNull();
});

test('한 날: 날짜 제목·사진(캡션·AI가 만든 그림)·"봄과 가을 중 고른 답"·낱말, 어르신이 친 글자 없음', async () => {
  await home({parentDays: [d1, d2]});
  await press('지난 날 보기');
  await waitFor(() => screen.getByTestId('history-item-2026-11-19'));
  await press('11월 19일 목요일, 고른 답 가을, 낱말 감나무');
  await waitFor(() => screen.getByRole('header', {name: '11월 19일 목요일'}));
  expect(screen.getByText('감 익는 마당')).toBeTruthy();
  expect(screen.getByText('AI가 만든 그림')).toBeTruthy();
  expect(screen.getByLabelText('봄과 가을 중 고른 답, 가을')).toBeTruthy();
  expect(screen.getByLabelText('낱말, 감나무')).toBeTruthy();
  await press('지난 날로');
  await waitFor(() => screen.getByText('최근 한 달 동안 본 사진이에요'));
});

test('한 날 · 보여 주지 않은 날: 고른 답 줄만 빠진다', async () => {
  await home({parentDays: [d1, d2]});
  await press('지난 날 보기');
  await waitFor(() => screen.getByTestId('history-item-2026-11-18'));
  await press('11월 18일 수요일, 낱말 느티나무');
  await waitFor(() => screen.getByRole('header', {name: '11월 18일 수요일'}));
  expect(screen.queryByText(/고른 답/)).toBeNull();
  expect(screen.getByLabelText('낱말, 느티나무')).toBeTruthy();
});

test('빈 상태: "사진을 보면 여기에 모여요"(아직 없어요 금지)', async () => {
  await home({parentDays: []});
  await press('지난 날 보기');
  await waitFor(() => screen.getByText('사진을 보면 여기에 모여요'));
  expect(screen.queryByText('최근 한 달 동안 본 사진이에요')).toBeNull();
});

test('불러오기 실패: 오류와 다시 하기', async () => {
  await home({parentDays: [d1], failParentHistory: 1});
  await press('지난 날 보기');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByTestId('history-item-2026-11-19'));
});

test('미연결 기기는 서버 기록이 없으므로 진입을 숨기고 부르지 않는다', async () => {
  const api = createFakeApi({parentDays: [d1]});
  const get = jest.spyOn(api, 'parentHistory');
  render(<AppRoot api={api} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId('course-strip'));
  expect(screen.queryByRole('button', {name: '지난 날 보기'})).toBeNull();
  expect(get).not.toHaveBeenCalled();
});

test('목록에서 뒤로(‹ 오늘 코스로)는 코스 홈으로', async () => {
  await home({parentDays: [d1]});
  await press('지난 날 보기');
  await waitFor(() => screen.getByTestId('history-item-2026-11-19'));
  await act(async () => fireEvent.press(screen.getAllByRole('button', {name: '오늘 코스로'})[0]));
  await waitFor(() => screen.getByTestId('date-line'));
});
