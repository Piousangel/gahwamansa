// 기획 v2.1 Q2 자녀 홈 '최근 한 달 고르신 것'(서버 0068 month): 사실 목록(날짜·질문·고르신 보기) + 답마다 챙겨 드릴 거리 한 줄(있을 때만).
// 숫자·횟수·순위 없음(Q3) — 보이는 숫자는 날짜뿐. 어르신 두 분이면 분마다. month 키가 없으면(v5) 지금 화면 그대로.
// 어르신 미리보기(Q13·P13)도 같은 파서·같은 컴포넌트.
import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import type {MonthItem} from '../src/features/types';
import {formatAnswerDate} from '../src/features/home/formatDate';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

setupWarmAppRoot();

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 2.75, fontScale: mockFontScale}),
}));
beforeEach(() => {
  mockFontScale = 1;
});

const LATEST = {prompt: null, choiceLabel: '시장 구경', answeredDate: '2025-11-25'};
const MONTH: MonthItem[] = [
  {answeredDate: '2025-11-25', promptShort: '시장 구경과 공원 산책 중', optionA: '시장 구경', optionB: '공원 산책', choiceLabel: '시장 구경', care: '가까운 시장 같이 구경 가기'},
  {answeredDate: '2025-11-23', promptShort: '국밥과 칼국수 중', optionA: '국밥', optionB: '칼국수', choiceLabel: '칼국수', care: null},
  {answeredDate: '2025-11-20', promptShort: '봄과 가을 중', optionA: '봄', optionB: '가을', choiceLabel: '가을', care: '가을 산 같이 걷기'},
];

// 보이는 글 전부(숨긴 것 포함, 날짜 글자는 뺀다)
function visibleText(node: ReturnType<typeof screen.getByTestId>): string[] {
  const out: string[] = [];
  const walk = (n: {children?: unknown[]}) =>
    (n.children ?? []).forEach(ch => (typeof ch === 'string' ? out.push(ch) : ch && typeof ch === 'object' ? walk(ch as never) : null));
  walk(node as never);
  return out;
}

test('목록: 제목 + 날짜순 행(날짜 · 짧은 질문 / 고르신 보기) + 챙겨 드릴 거리 줄은 있는 답에만, 31일 안내', async () => {
  render(<AppRoot api={createFakeApi({parents: [{title: '엄마', latest: LATEST, month: MONTH}]})} role="child" />);
  const list = await waitFor(() => screen.getByTestId('month-list'));
  expect(within(list).getByText('최근 한 달 고르신 것')).toBeTruthy();
  const rows = within(list).getAllByTestId('month-row');
  expect(rows.map(r => r.props.accessibilityLabel)).toEqual([
    `${formatAnswerDate('2025-11-25')}, 시장 구경과 공원 산책 중, 시장 구경, 챙겨 드릴 거리, 가까운 시장 같이 구경 가기`,
    `${formatAnswerDate('2025-11-23')}, 국밥과 칼국수 중, 칼국수`,
    `${formatAnswerDate('2025-11-20')}, 봄과 가을 중, 가을, 챙겨 드릴 거리, 가을 산 같이 걷기`,
  ]);
  // care 줄은 '›' + 문장만 보이고(이름은 읽기에만), care 없는 답에는 줄이 없다
  expect(within(rows[0]).getByText('› 가까운 시장 같이 구경 가기')).toBeTruthy();
  expect(within(rows[1]).queryAllByTestId('month-care')).toHaveLength(0);
  expect(within(rows[2]).getAllByTestId('month-care')).toHaveLength(1);
  expect(within(list).getByText('한 달이 지난 것은 지워져요')).toBeTruthy();
  // 한 행이 한 덩어리로 읽힌다(누르는 것 아님)
  expect(rows[0].props.accessible).toBe(true);
  expect(rows[0].props.accessibilityRole).toBeUndefined();
});

test('숫자·횟수·순위 0: 날짜를 뺀 목록 글자에 숫자·개수·순위 말이 없다', async () => {
  render(<AppRoot api={createFakeApi({parents: [{title: '엄마', latest: LATEST, month: MONTH}]})} role="child" />);
  const list = await waitFor(() => screen.getByTestId('month-list'));
  let words = visibleText(list).join(' ');
  for (const m of MONTH) {
    words = words.split(formatAnswerDate(m.answeredDate)).join('');
  }
  expect(words).toContain('시장 구경'); // 글자를 실제로 모았다
  expect(words).not.toMatch(/\d|번째|가지|개|위|순위|가장|자주|많이/);
});

test('care 가 하나도 없으면 줄 없이 사실만', async () => {
  const month = MONTH.map(m => ({...m, care: null}));
  render(<AppRoot api={createFakeApi({parents: [{title: '엄마', latest: LATEST, month}]})} role="child" />);
  await waitFor(() => screen.getByTestId('month-list'));
  expect(screen.queryAllByTestId('month-care')).toHaveLength(0);
  expect(screen.queryByText(/챙겨 드릴 거리/)).toBeNull();
});

test('빈 목록: 고르신 것이 여기 모여요', async () => {
  render(<AppRoot api={createFakeApi({parents: [{title: '엄마', latest: LATEST, month: []}]})} role="child" />);
  const list = await waitFor(() => screen.getByTestId('month-list'));
  expect(within(list).getByText('고르신 것이 여기 모여요')).toBeTruthy();
  expect(within(list).queryAllByTestId('month-row')).toHaveLength(0);
});

test('month 키가 없으면(v5 동의) 지금 화면 그대로 — 목록 없음', async () => {
  render(<AppRoot api={createFakeApi({parents: [{title: '엄마', latest: LATEST}]})} role="child" />);
  await waitFor(() => screen.getByText('엄마의 최근 답'));
  expect(screen.queryByTestId('month-list')).toBeNull();
  expect(screen.queryByText('최근 한 달 고르신 것')).toBeNull();
});

test('어르신 두 분: 분마다 호칭 머리 + 각자 목록(v5 인 분은 목록 없음)', async () => {
  render(
    <AppRoot
      api={createFakeApi({
        parents: [
          {title: '엄마', latest: LATEST, month: MONTH.slice(0, 1)},
          {title: '아빠', latest: LATEST, month: MONTH.slice(1, 2)},
          {title: '할머니', latest: LATEST}, // v5
        ],
      })}
      role="child"
    />,
  );
  const list = await waitFor(() => screen.getByTestId('month-list'));
  const groups = within(list).getAllByTestId('month-parent');
  expect(groups).toHaveLength(2);
  expect(within(groups[0]).getByText('엄마')).toBeTruthy();
  expect(within(groups[0]).getAllByTestId('month-row')[0].props.accessibilityLabel).toMatch(/^엄마, /); // 두 분이면 읽기에도 누구 답인지
  expect(within(groups[1]).getByText('아빠')).toBeTruthy();
  expect(within(groups[1]).getAllByTestId('month-row')).toHaveLength(1);
  expect(within(list).queryByText('할머니')).toBeNull();
});

test('큰 글자 200%: 목록 글자는 잘리지 않는다(말줄임 없음)', async () => {
  mockFontScale = 2;
  render(<AppRoot api={createFakeApi({parents: [{title: '엄마', latest: LATEST, month: MONTH}]})} role="child" />);
  const list = await waitFor(() => screen.getByTestId('month-list'));
  const texts = list.findAll(n => typeof n.props?.numberOfLines === 'number' && n.props.numberOfLines > 0);
  expect(texts).toHaveLength(0);
});

test('어르신 미리보기(P13): month 가 있으면 지난 답 두 줄 대신 같은 목록', async () => {
  const api = createFakeApi({linked: true, consented: true, parentTitle: '엄마', consentVersion: 'v6', latest: LATEST, month: MONTH});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await press('가족에게 이렇게 보여요');
  await waitFor(() => expect(screen.queryByTestId('preview-loading')).toBeNull());
  const device = screen.getByTestId('preview-device');
  expect(within(device).getByTestId('preview-latest')).toBeTruthy();
  expect(within(device).getByTestId('month-list')).toBeTruthy();
  expect(within(device).getAllByTestId('month-row')).toHaveLength(3);
  expect(within(device).queryAllByTestId('preview-older')).toHaveLength(0);
});
