// 작은 화면 묶음(11-25, DS-1) — 대기열 34·35.
// 34: ⑤ 이야기 건네기의 「오늘은 넘어갈게요」를 ②처럼 배율과 상관없이 카드 아래 본문으로(360×640 100%에서 Dock 보조 줄이 본문 창을 줄여
//     첫 화면에 카드가 1장만 보였다). 넘어가기가 첫 화면 밖이 되므로 꺼진 [건넬게요] 읽기 힌트가 그 길을 알린다(pass_on.need_choice).
// 35: 5단계 ③ 꺼진 [정했어요] 힌트는 넘어가는 길까지 말한다(question.need_choice_five). 3단계는 넘어가기가 없어 그대로.
import React from 'react';
import {StyleSheet} from 'react-native';
import {ds} from '../src/ui/ds/roles';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {pressCourseNext} from '../testUtils/flow';
import {copy} from '../src/copy/copy';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));

beforeEach(async () => {
  setFeature('fiveSteps', true);
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
  mockFontScale = 1;
});

async function open(opts: FakeOptions, ready: string | RegExp) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: ready}));
}
const order = (ids: string[]) => [...new Set(screen.UNSAFE_root.findAll(n => typeof n.type === 'string' && ids.includes(n.props?.testID)).map(n => n.props.testID as string))];

for (const scale of [1, 2]) {
  test(`대기열 34 글자 ${scale * 100}%: ⑤ 넘어가기는 Dock 이 아니라 카드 아래 본문(묶음 간격), 꺼진 [건넬게요] 힌트가 그 길을 알린다`, async () => {
    mockFontScale = scale;
    await open({completedSteps: ['photo', 'recall', 'question', 'hangul'], recallSlot: 2}, '건넬게요');
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
    expect(within(screen.getByTestId('pass-on-skip-gap')).getByRole('button', {name: '오늘은 넘어갈게요'})).toBeTruthy();
    expect(order(['pass-on-choice', 'pass-on-skip-gap'])).toEqual(['pass-on-choice', 'pass-on-skip-gap']);
    // #277 QA-1 L1: 마지막 카드와 넘어가기 사이 = 묶음 간격 32(본문 간격 12 + 위 여백 20, ②와 같음)
    expect(StyleSheet.flatten(screen.getByTestId('pass-on-skip-gap').props.style).paddingTop + 12).toBe(ds.space.section);
    expect(ds.space.section).toBe(32);
    const confirm = dock.getByRole('button', {name: '건넬게요'});
    expect(confirm.props.accessibilityHint).toBe(copy.pass_on.need_choice);
    expect(copy.pass_on.need_choice).toBe("한 줄을 고르면 눌려요. 넘어가려면 '오늘은 넘어갈게요'를 눌러 주세요");
    // 보이는 이유 줄은 없다(시안 s2·s3 — 힌트로만)
    expect(screen.queryByText(copy.pass_on.need_choice, {includeHiddenElements: true})).toBeNull();
    fireEvent.press(screen.getAllByRole('radio')[0]);
    expect(dock.getByRole('button', {name: '건넬게요'}).props.accessibilityHint).toBeUndefined();
  });
}

test('대기열 35: 5단계 ③ 꺼진 [정했어요]는 넘어가는 길까지 말하는 힌트만(보이는 이유 줄 없음)', async () => {
  await open({completedSteps: ['photo', 'recall'], recallSlot: 2}, '정했어요');
  const btn = within(screen.getByTestId('screen-dock')).getByRole('button', {name: '정했어요'});
  expect(btn.props.accessibilityHint).toBe("한쪽을 고르면 눌려요. 넘어가려면 '오늘은 넘어갈게요'를 눌러 주세요");
  expect(screen.queryByText('한쪽을 고르면 눌려요', {includeHiddenElements: true})).toBeNull();
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '오늘은 넘어갈게요'})).toBeTruthy();
});

test('대기열 35: 3단계 ③는 그대로 — 이유 줄 + 힌트 「한쪽을 고르면 눌려요」(넘어가기 없음)', async () => {
  setFeature('fiveSteps', false);
  await open({completedSteps: ['photo']}, '정했어요');
  const btn = within(screen.getByTestId('screen-dock')).getByRole('button', {name: '정했어요'});
  expect(btn.props.accessibilityHint).toBe('한쪽을 고르면 눌려요');
  expect(screen.getByText('한쪽을 고르면 눌려요', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
});
