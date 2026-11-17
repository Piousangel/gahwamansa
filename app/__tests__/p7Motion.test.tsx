import React from 'react';
import {AccessibilityInfo, StyleSheet, Switch} from 'react-native';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {createStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {kstWeekdayIndex} from '../src/features/course/stamps';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';

// P7 도장 '쾅'(동결 시안 P7_motion): 1.3→1.0 → 눌림 → 인주 번짐 → 문구 → 오늘 칸으로 이동(약 1.4초),
// 화면을 누르면 끝 상태, 첫 1회 건너뛰기 안내, 촉각 1회·소리 1회, 동작 줄이기면 200ms 페이드만.
let prefs: Prefs;
let play: jest.Mock;
let vibrate: jest.Mock;
beforeEach(() => {
  prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
  play = jest.fn();
  vibrate = jest.fn();
  setStampFeedbackForTest(() =>
    createStampFeedback({player: {playStamp: play}, vibrate, ringer: async () => 'normal', ttsSpeaking: () => false, prefs}),
  );
});
afterEach(() => {
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  setStampFeedbackForTest(null);
  jest.restoreAllMocks();
});

async function finish(opts: FakeOptions = {}) {
  await toHomeConsented(createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question'], ...opts}));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
}
const today = kstWeekdayIndex();

test('처음: 큰 도장이 나오고, 첫 1회 "화면을 누르면 바로 넘어가요", 촉각 1회·소리 1회', async () => {
  await finish();
  expect(screen.getByTestId('p7-stamp-big', {includeHiddenElements: true})).toBeTruthy();
  await waitFor(() => screen.getByText('화면을 누르면 바로 넘어가요'));
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(play).toHaveBeenCalledTimes(1);
});

test('화면을 누르면 끝 상태: 큰 도장 사라지고 오늘 칸에 도장, 문구 보임, 소리·촉각은 다시 울리지 않음', async () => {
  await finish();
  fireEvent.press(screen.getByTestId('p7-stage'));
  await waitFor(() => expect(screen.queryByTestId('p7-stamp-big', {includeHiddenElements: true})).toBeNull());
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
  expect(screen.getByText(/도장을 찍었어요|오늘 첫 도장을 찍었어요/)).toBeTruthy();
  expect(vibrate).toHaveBeenCalledTimes(1);
  expect(play.mock.calls.length).toBeLessThanOrEqual(1);
  expect(await prefs.skipHintSeen()).toBe(true);
});

test('기다리면(약 1.4초) 스스로 끝 상태가 된다', async () => {
  await finish();
  await waitFor(() => expect(screen.queryByTestId('p7-stamp-big', {includeHiddenElements: true})).toBeNull(), {timeout: 3000});
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
});

test('건너뛰기 안내는 이미 봤으면 다시 나오지 않는다', async () => {
  await prefs.markSkipHintSeen();
  await finish();
  expect(screen.queryByText('화면을 누르면 바로 넘어가요')).toBeNull();
});

test('동작 줄이기: 크기·이동 없이 페이드만(큰 도장 없음), 촉각은 유지', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await finish();
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('p7-stamp-big', {includeHiddenElements: true})).toBeNull();
  expect(screen.queryByText('화면을 누르면 바로 넘어가요')).toBeNull();
  await waitFor(() => expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0));
});

test('효과음을 끄면 소리 없이 촉각만', async () => {
  await prefs.setSfxEnabled(false);
  await finish();
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(play).not.toHaveBeenCalled();
});

test('미연결도 같은 도장 연출(기기에 찍힘), 문구 11-7 #19', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId('course-strip'));
  for (const step of ['다 봤어요', '정했어요']) {
    await pressCourseNext();
    if (step === '정했어요') {
      await waitFor(() => screen.getByText('봄'));
      fireEvent.press(screen.getByText('봄'));
    }
    await waitFor(() => screen.getByRole('button', {name: step}));
    await press(step);
    await waitFor(() => screen.getByTestId('date-line'));
  }
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-stage'));
  fireEvent.press(screen.getByTestId('p7-stage')); // 연출 중이면 끝 상태로(이미 끝났으면 아무 일 없음)
  await waitFor(() => screen.getByText(/번호를 받으면 그때부터 고른 답이 가족에게 보여요/));
  expect(vibrate).toHaveBeenCalledTimes(1); // 같은 도장 연출(닿는 순간 촉각 1회)
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
});

describe('P3 단계 체크 모션', () => {
  test('단계를 마치고 돌아오면 그 행만 체크 모션, 다음 행은 테이프 모션(처음 열 때는 없음)', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    expect(screen.queryByTestId('step-check-anim', {includeHiddenElements: true})).toBeNull();
    expect(screen.queryByTestId('step-tape-anim', {includeHiddenElements: true})).toBeNull();
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    expect(screen.getAllByTestId('step-check-anim', {includeHiddenElements: true})).toHaveLength(1);
    expect(screen.getAllByTestId('step-tape-anim', {includeHiddenElements: true})).toHaveLength(1);
    expect(vibrate).not.toHaveBeenCalled(); // 단계 체크에는 진동·소리 없음
    expect(play).not.toHaveBeenCalled();
  });
});

describe('설정 효과음 토글(P13)', () => {
  test('"효과음" 스위치(기본 켜짐, 보조 "도장을 찍을 때 짧은 소리"), 끄면 저장', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    const sw = await waitFor(() => screen.getByRole('switch', {name: '효과음'}));
    await waitFor(() => expect(screen.getByRole('switch', {name: '효과음'}).props.accessibilityState?.checked ?? sw.props.value).toBe(true));
    expect(screen.getByText('도장을 찍을 때 짧은 소리', {includeHiddenElements: true})).toBeTruthy(); // 보이는 글, 읽기는 스위치 힌트
    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', false);
    await waitFor(async () => expect(await prefs.sfxEnabled()).toBe(false));
    expect(StyleSheet.flatten(screen.getByTestId('sfx-row').props.style).minHeight).toBeGreaterThanOrEqual(64);
  });
});
