// 독립 감사 H2(P5 360×640 카드 안 보임) → 디자인 판정 9절 공간 단계·예산 테스트. 감사 재현 조건(기기 높이·글자 배율)으로 본다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {p5Level, p5Need} from '../src/features/course/p5Space';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {memoryStore} from '../src/lib/kvStore';
import {pressCourseNext} from '../testUtils/flow';

let mockDims = {width: 390, height: 844, scale: 3, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));
beforeEach(() => setLocalStampsForTest(createLocalStamps(memoryStore())));
afterEach(() => {
  setLocalStampsForTest(null);
  mockDims = {width: 390, height: 844, scale: 3, fontScale: 1};
});

test('예산(디자인 판정 계산): 0단계 706 · 1단계 612 · 2단계 590 · 3단계 518', () => {
  expect([p5Need(0), p5Need(1), p5Need(2), p5Need(3)]).toEqual([706, 612, 590, 518]);
});

test('기대 단계: S25 가용 780 → 0, 360×740(가용 약 700) → 1, 360×640(가용 약 600) → 3, 320×640·150% → 스크롤(5)', () => {
  expect(p5Level(780)).toBe(0);
  expect(p5Level(700)).toBe(1);
  expect(p5Level(600)).toBe(3); // 2단계 590 은 빠듯(여유 16) → 3
  expect(p5Level(600, 1.5)).toBe(5);
});

async function toP5(height: number, fontScale = 1) {
  mockDims = {width: 360, height, scale: 3, fontScale};
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  return waitFor(() => screen.getByTestId('choice-group'));
}

test('위계(모든 크기): 질문이 큰 제목 28, 지시문은 보조', async () => {
  await toP5(844);
  const q = screen.getByTestId('p5-question');
  expect(StyleSheet.flatten(q.props.style).fontSize).toBe(28);
  expect(screen.getByTestId('p5-instruction')).toBeTruthy();
  expect(screen.getByTestId('p5-hint')).toBeTruthy(); // 0단계만
});

test('360×640(감사 재현): 3단계 — 정답은 없어요·지시문·오늘 코스로 숨김, 카드 96, 이유 줄은 아직 보임', async () => {
  const group = await toP5(600);
  expect(screen.queryByTestId('p5-hint')).toBeNull();
  expect(screen.queryByTestId('p5-instruction')).toBeNull();
  expect(screen.queryByTestId('to-course-home')).toBeNull();
  for (const card of within(group).getAllByRole('radio')) {
    const st = typeof card.props.style === 'function' ? card.props.style({pressed: false}) : card.props.style;
    expect(StyleSheet.flatten(st).minHeight).toBe(96);
  }
  expect(screen.getByText('하나를 골라 주세요', {includeHiddenElements: true})).toBeTruthy(); // 보이는 줄(읽기는 버튼 힌트)
  // 읽어 주기는 카드 아래(예산 밖): 트리에서 카드 묶음 뒤
  const body = screen.getByTestId('screen-body');
  const ids: string[] = [];
  const walk = (n: {props?: {testID?: string}; children?: unknown[]}) => {
    if (n.props?.testID) ids.push(n.props.testID);
    (n.children ?? []).forEach(ch => ch && typeof ch === 'object' && walk(ch as never));
  };
  walk(body as never);
  expect(ids.indexOf('read-aloud')).toBeGreaterThan(ids.indexOf('choice-group'));
});

test('360×740: 1단계 — 정답은 없어요만 숨김, 카드 132', async () => {
  const group = await toP5(700);
  expect(screen.queryByTestId('p5-hint')).toBeNull();
  expect(screen.getByTestId('p5-instruction')).toBeTruthy();
  const card = within(group).getAllByRole('radio')[0];
  const st = typeof card.props.style === 'function' ? card.props.style({pressed: false}) : card.props.style;
  expect(StyleSheet.flatten(st).minHeight).toBe(132);
});

test('4단계 이상(아주 낮은 화면): 하나를 골라 주세요는 화면에서 빼고 비활성 버튼의 읽기 힌트로만', async () => {
  await toP5(500);
  expect(screen.queryByText('하나를 골라 주세요', {includeHiddenElements: true})).toBeNull();
  expect(screen.getByRole('button', {name: '정했어요'}).props.accessibilityHint).toBe('하나를 골라 주세요');
});
