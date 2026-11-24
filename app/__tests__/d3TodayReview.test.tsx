// D-3 '오늘 코스 다시 보기' 안 A '오늘 한 장'(DECISIONS 2026-11-24, 시안 docs/design/2026-11-24-d2-d3-c4/d3-course-review.html).
// 한 화면 세로 스크롤: BackLink '오늘 코스로' → 날짜 → 사진(누르면 크게, 원본 비율) → 사진 이름·AI 고지 → 고르신 쪽 노랑 팻말 + '다른 하나 · {안 고른 쪽}'
// → 오늘 낱말. Dock = '읽어 주세요'(돌아가기는 BackLink 하나). D-1 '먼저 떠오른 것' 자리는 아직 없다. 기록·계측 호출 0.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {press} from '../testUtils/flow';
import {roleText} from '../src/ui/ds/roles';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

const kstDateLine = () => {
  const d = new Date(Date.now() + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][d.getUTCDay()]}`;
};

async function review(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul'], answeredChoice: 'A', realImage: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  const spies = (['recordSessionStep', 'logEvent', 'startToday', 'getTodayContent', 'saveAnswer'] as const).map(k => jest.spyOn(api, k));
  await press('오늘 코스 다시 보기');
  await waitFor(() => screen.getByTestId('today-review'));
  return {api, calls: () => spies.map(s => s.mock.calls.length)};
}

function order(ids: string[]): string[] {
  const all = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && ids.includes(n.props.testID) && typeof n.type === 'string');
  return [...new Set(all.map(n => n.props.testID as string))];
}

const ORDER = ['review-date', 'photo-polaroid', 'review-caption', 'ai-notice', 'review-choice-label', 'sign', 'review-other', 'review-word'];

test('P3 Dock "오늘 코스 다시 보기" → 오늘 한 장: 위에서 아래로 날짜 → 사진 → 이름·AI 고지 → 팻말 + 다른 하나 → 오늘 낱말', async () => {
  await review();
  expect(order(ORDER)).toEqual(ORDER);
  expect(screen.getByRole('link', {name: '오늘 코스로'})).toBeTruthy(); // 위 BackLink
  expect(within(screen.getByTestId('review-date')).getByText(kstDateLine())).toBeTruthy();
  expect(screen.getByText('마을 입구 나무')).toBeTruthy();
  expect(screen.getByTestId('ai-notice')).toHaveTextContent('AI가 만든 그림·실제 장소가 아니에요');
  expect(screen.getByText('더 좋아하는 계절은요? · 고르신 쪽')).toBeTruthy();
  expect(screen.getByText('다른 하나 · 가을')).toBeTruthy();
  expect(screen.getByText('오늘 낱말')).toBeTruthy();
  expect(screen.getByText('나무')).toBeTruthy();
  // D-1 '먼저 떠오른 것' 자리는 아직 없다
  expect(screen.queryByText(/먼저 떠오/)).toBeNull();
});

test('팻말은 화면에 1개(row 크기, 고르신 쪽), 읽기 "오늘 고르신 쪽, 봄" — 안 고른 쪽은 팻말이 아니라 흐린 보조 글자', async () => {
  await review();
  const signs = screen.getAllByTestId('sign');
  expect(signs).toHaveLength(1);
  expect(signs[0].props.accessibilityLabel).toBe('오늘 고르신 쪽, 봄');
  expect(within(signs[0]).getByText('봄', {includeHiddenElements: true})).toBeTruthy();
  const other = screen.getByText('다른 하나 · 가을');
  const st = StyleSheet.flatten(other.props.style);
  expect(st.color).toBe(roleText('sub', 'elder').style.color); // 흐림 = 보조 글자색(불투명도 아님)
  expect(st.opacity ?? 1).toBe(1);
  expect(other.props.maxFontSizeMultiplier).toBe(1.5); // 200%에서 팻말 글자(26×1.5)보다 커지지 않게
});

test('Dock 은 "읽어 주세요" 하나(돌아가기는 위 BackLink 만), BackLink 로 코스 홈, 기록·계측·다시 불러오기 0', async () => {
  const {calls} = await review();
  const before = calls();
  const dock = screen.getByTestId('screen-dock');
  expect(within(dock).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['읽어 주세요']);
  expect(screen.getAllByRole('link', {name: '오늘 코스로'})).toHaveLength(1);
  expect(screen.queryByRole('button', {name: '오늘 코스로'})).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole('link', {name: '오늘 코스로'})));
  await waitFor(() => screen.getByTestId('date-line'));
  expect(calls()).toEqual(before);
});

test('사진: 원본 비율 틀(가로 사진 312×251), 다 불러오면 눌러 크게 보기', async () => {
  await review();
  fireEvent(screen.getByTestId('photo-image'), 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
  const frame = StyleSheet.flatten(screen.getByTestId('photo-polaroid').props.style);
  expect({width: frame.width, height: frame.height}).toEqual({width: 312, height: 251});
  const photo = screen.getByTestId('photo-polaroid');
  expect(photo.props.accessibilityRole).toBe('button');
  await act(async () => fireEvent.press(photo));
  expect(screen.getByTestId('zoom-modal').props.visible).toBe(true);
});

test('저장된 답이 없는 날(동의 거부): 팻말·다른 하나 줄 없이 사진과 낱말만', async () => {
  await review({consented: false, answeredChoice: undefined});
  expect(screen.queryByTestId('sign')).toBeNull();
  expect(screen.queryByTestId('review-other')).toBeNull();
  expect(screen.queryByText(/고르신 쪽/)).toBeNull();
  expect(screen.getByText('나무')).toBeTruthy();
});

test('200%: 같은 순서로 세로 스크롤(사진을 줄이지 않음), Dock 은 그대로 읽어 주세요', async () => {
  mockFontScale = 2;
  await review();
  expect(order(ORDER)).toEqual(ORDER);
  expect(within(screen.getByTestId('screen-dock')).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['읽어 주세요']);
});
