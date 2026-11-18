// AP-06 P13 '가족에게 이렇게 보여요'(시안 P13_more, 디자인 확인 11-19 두 상태). 자녀 화면에 실제로 보이는 것(호칭·고른 답·날짜)만.
import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import type {HistoryDay} from '../src/api/contract/history';
import {stackScreenOptions, backGestureOptions} from '../src/navigation/stackOptions';
import {press} from '../testUtils/flow';

const day = (session_date: string, a: string, b: string, choice: string | null): HistoryDay => ({
  session_date,
  day_index: 1,
  completed: true,
  photo: {caption: '사진', image_url: 'https://example.test/p.jpg', keyword: '나무'},
  question: {prompt: `${a}과 ${b} 중 어느 쪽이 좋으세요?`, option_a: a, option_b: b},
  choice_label: choice,
});
const DAYS = [day('2025-11-16', '봄', '가을', '가을'), day('2025-11-15', '산', '바다', '바다'), day('2025-11-14', '빵', '떡', null), day('2025-11-13', '곶감', '홍시', '홍시'), day('2025-11-10', '눈', '비', '눈')];

async function openPreview(opts: FakeOptions) {
  render(<AppRoot api={createFakeApi({linked: true, parentTitle: '엄마', ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await press('가족에게 이렇게 보여요');
  await waitFor(() => expect(screen.queryByTestId('preview-loading')).toBeNull());
  return screen.getByTestId('preview-device');
}

test('설정: 답 보여 주기 행 아래 "가족에게 이렇게 보여요" › 행', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  const ids = screen.UNSAFE_root.findAll(n => ['settings-row-share', 'settings-row-preview', 'settings-row-family'].includes(n.props?.testID)).map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['settings-row-share', 'settings-row-preview', 'settings-row-family']);
});

test('답 있음: 호칭의 최근 답 카드(고른 답·날짜) + 지난 답 2줄(날짜 · 짧은 질문 · 고른 답). 답 없는 날은 건너뛴다, 사진·낱말 없음', async () => {
  const device = await openPreview({consented: true, parentDays: DAYS});
  expect(within(device).getByText('가족 휴대폰 화면')).toBeTruthy();
  const latest = within(device).getByTestId('preview-latest');
  expect(latest.props.accessibilityLabel).toBe('엄마의 최근 답, 가을, 2025년 11월 16일');
  const older = within(device).getAllByTestId('preview-older');
  expect(older.map(o => o.props.accessibilityLabel)).toEqual(['2025년 11월 15일, 산과 바다 중, 바다', '2025년 11월 13일, 곶감과 홍시 중, 홍시']);
  expect(within(device).queryByText(/나무|사진/)).toBeNull();
  expect(screen.getByTestId('preview-sub').props.children).toBe('최근 한 달 고른 답과 날짜가 보여요. 연결된 날과 답을 보여 주는 중인지도 보여요');
  expect(screen.getByText('• 사진과 자판으로 쓴 글자는 보이지 않아요')).toBeTruthy();
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('settings-row-preview'));
});

test('동의 거부·철회: "가족 휴대폰 화면" 윗줄 유지 + "엄마의 최근 답 / 답을 나누지 않는 중이에요", 고른 답 없음, 소개문은 sub_off', async () => {
  const device = await openPreview({consented: false, parentDays: DAYS});
  expect(within(device).getByText('가족 휴대폰 화면')).toBeTruthy();
  const card = within(device).getByTestId('preview-not-shared');
  expect(within(card).getByText('엄마의 최근 답')).toBeTruthy();
  expect(within(card).getByText('답을 나누지 않는 중이에요')).toBeTruthy();
  expect(within(device).queryByText('가을')).toBeNull();
  expect(screen.getByTestId('preview-sub').props.children).toBe('지금은 고른 답이 가족에게 보이지 않아요. 답을 보여 주지 않는 중인 것만 보여요'); // 라이터 sub_off
  expect(screen.queryByTestId('preview-notes')).toBeNull(); // 거부 상태에서는 '보이지 않아요' 두 줄 없음
});

test('아직 고른 답 없음: "고른 답이 생기면 여기에 보여요", 소개문은 그대로', async () => {
  const device = await openPreview({consented: true, parentDays: []});
  expect(within(within(device).getByTestId('preview-empty')).getByText('고른 답이 생기면 여기에 보여요')).toBeTruthy();
  expect(screen.getByTestId('preview-sub').props.children).toMatch(/^최근 한 달/);
});

test('스와이프 뒤로 자리(iOS 감사 2.4): 지금은 두 플랫폼 모두 기본 동작 그대로(gestureEnabled 를 넣지 않음)', () => {
  expect(backGestureOptions('android')).toEqual({});
  expect(backGestureOptions('ios')).toEqual({});
  expect(stackScreenOptions('android')).toEqual({headerShown: false});
  expect(stackScreenOptions('ios')).toEqual({headerShown: false});
});
