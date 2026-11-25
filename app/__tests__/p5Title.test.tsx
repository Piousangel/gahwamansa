import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {roleText} from '../src/ui/ds/roles';
import {pressCourseNext} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

// P5 제목(시안 P3_P4_P5_ds4b): 단계 제목 한 줄 → 질문(title) → '정답은 없어요…'(sub muted, 늘 한 줄). 질문 문장이 없는 날은 공통 문장이 제목.
async function toQuestion(opts: FakeOptions = {}) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo'], ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('choice-group'));
}

test('위계(시안 P5 ds4b): 질문이 제목(title 역할), 그 아래 정답은 없어요(보조 muted), 지시문 줄은 없다', async () => {
  await toQuestion();
  const prompt = screen.getByText('더 좋아하는 계절은요?');
  const title = roleText('title', 'elder').style;
  expect(StyleSheet.flatten(prompt.props.style).fontSize).toBe(title.fontSize);
  expect(StyleSheet.flatten(prompt.props.style).fontWeight).toBe('700');
  const hint = screen.getByText('정답은 없어요. 하나를 눌러 주세요');
  expect(StyleSheet.flatten(hint.props.style).color).toBe(roleText('sub', 'elder', 'muted').style.color);
  expect(screen.queryByText('마음에 드는 쪽을 골라 주세요')).toBeNull();
});

test('질문 문장이 없는 날은 공통 문장이 제목(한 번만)', async () => {
  await toQuestion({promptNull: true});
  expect(screen.getAllByText('마음에 드는 쪽을 골라 주세요')).toHaveLength(1);
});

test('머리줄(요즘 생각대로)과 안내(정답은 없어요)가 따로, 판단어 「마음 가는 쪽」은 없다(기획 v2.1 Q1)', async () => {
  await toQuestion();
  expect(screen.getByTestId('p5-headline').props.children).toBe('요즘 생각대로 한쪽을 골라요');
  expect(screen.getByTestId('p5-hint').props.children).toBe('정답은 없어요. 하나를 눌러 주세요');
  expect(screen.queryByText(/마음 가는 쪽/)).toBeNull();
  expect(screen.getAllByText(/요즘 생각대로/)).toHaveLength(1);
});

test('200%: 단계 표시 2 / 3 만(P4와 같은 짧은 표시, 읽기는 그대로)', async () => {
  mockFontScale = 2;
  await toQuestion();
  expect(screen.getByText('2 / 3')).toBeTruthy();
  expect(screen.queryByText(/둘 중 고르기 ·/)).toBeNull();
  expect(screen.getByTestId('step-header').props.accessibilityLabel).toBe('둘 중 고르기, 3단계 중 2단계');
});

test('100%: 단계 제목은 이름까지 한 줄 그대로', async () => {
  await toQuestion();
  expect(screen.getByText('둘 중 고르기 · 2 / 3')).toBeTruthy();
});

// #257 QA-2 L1: 문턱은 P4와 같은 150%(PhotoStep large). 1.4는 이름까지 한 줄, 1.5부터 짧은 표시
test.each([
  [1.4, '둘 중 고르기 · 2 / 3', '2 / 3'],
  [1.5, '2 / 3', '둘 중 고르기 · 2 / 3'],
])('글자 %s배: 단계 표시 「%s」(경계)', async (scale, shown, hidden) => {
  mockFontScale = scale;
  await toQuestion();
  expect(screen.getByText(shown)).toBeTruthy();
  expect(screen.queryByText(hidden)).toBeNull();
  expect(screen.getByTestId('step-header').props.accessibilityLabel).toBe('둘 중 고르기, 3단계 중 2단계');
});

// #257 QA-2 L2: 안내('하나를 눌러 주세요')와 [정했어요] 비활성 이유가 화면 읽기에서 같은 말로 들리지 않게 — 이유는 버튼 상태를 말한다(P6 '한 글자라도 쓰면 눌려요'와 같은 꼴)
test('[정했어요] 비활성 이유는 「한쪽을 고르면 눌려요」, 안내와 다른 말', async () => {
  await toQuestion({completedSteps: ['photo']});
  const hint = screen.getByTestId('p5-hint').props.children;
  const btn = screen.getByRole('button', {name: '정했어요'});
  expect(btn.props.accessibilityHint).toBe('한쪽을 고르면 눌려요');
  expect(btn.props.accessibilityHint).not.toContain('하나를');
  expect(hint).toBe('정답은 없어요. 하나를 눌러 주세요');
});
