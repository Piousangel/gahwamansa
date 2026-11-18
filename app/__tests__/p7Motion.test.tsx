import React from 'react';
import {AccessibilityInfo, StyleSheet, Switch} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {createStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {P7_T, setMeasureForTest, type Box} from '../src/features/course/CourseDone';
import {kstWeekdayIndex} from '../src/features/course/stamps';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';

// P7 도장 '쾅'(동결 시안 P7_motion): 1.3→1.0 → 눌림 → 인주 번짐 → 제목·문구 → 오늘 칸으로 이동(약 1.4초),
// 화면을 누르면 끝 상태, 첫 1회 건너뛰기 안내(하단 독), 촉각 1회·소리 1회, 동작 줄이기면 120 도장 제자리 200ms 페이드.
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
  setMeasureForTest(null);
  jest.useRealTimers();
  jest.restoreAllMocks();
  // 프리셋의 이 함수들은 이미 jest.fn 이라 spyOn 이 같은 함수를 돌려주고 restoreAllMocks 가 구현을 되돌리지 않는다.
  // 다음 테스트에 '판정 대기'나 '줄이기'가 새지 않게 기본값으로 되돌린다(테스트 불안정 원인, 리뷰 L6).
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

async function finish(opts: FakeOptions = {}) {
  await toHomeConsented(createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question'], ...opts}));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-stage'));
}
const today = kstWeekdayIndex();
const big = () => screen.queryByTestId('p7-stamp-big', {includeHiddenElements: true});
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
// 가짜 시계에서는 흐름 테스트의 waitFor 가 시간을 흘려보내므로, 동작 줄이기 판정을 붙잡아 연출 시작 시점을 테스트가 정한다
function holdMotion() {
  let release: (v: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise<boolean>(r => (release = r)));
  return async (reduce = false) => {
    await act(async () => release(reduce));
  };
}
// 측정 대역: 첫 호출 = 큰 도장, 둘째 = 오늘 칸
function stubMeasure(ok: boolean) {
  const boxes: Box[] = [
    {x: 135, y: 120, w: 120, h: 120},
    {x: 60, y: 520, w: 40, h: 40},
  ];
  let i = 0;
  const f = jest.fn(async () => (ok ? boxes[i++ % 2] : null));
  setMeasureForTest(f);
  return f;
}

test('타임라인 값은 시안 P7_motion 과 같다', () => {
  expect(P7_T).toEqual({land: 180, squash: 140, inkAt: 220, ink: 420, textAt: 500, text: 200, flyAt: 900, fly: 480, fade: 200});
});

describe('도장 쾅(가짜 시계)', () => {
  test('180ms 에 촉각·소리 1회, 900ms 측정 성공이면 오늘 칸으로 날아가 1380ms 에 끝, 끝나면 완료 해님', async () => {
    jest.useFakeTimers();
    const m = stubMeasure(true);
    const go = holdMotion();
    await finish();
    await go();
    expect(big()).toBeTruthy();
    expect(vibrate).not.toHaveBeenCalled();
    await advance(P7_T.land + 20);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    await advance(P7_T.flyAt - P7_T.land);
    expect(m).toHaveBeenCalledTimes(2); // 큰 도장·오늘 칸
    await advance(P7_T.fly - 100);
    expect(big()).toBeTruthy(); // 아직 나는 중(측정 성공이면 480ms 이동, 실패 폴백 200ms 보다 길다)
    await advance(200);
    expect(big()).toBeNull();
    expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  test('측정이 안 되면 날지 않고 200ms 페이드로 사라진다', async () => {
    jest.useFakeTimers();
    stubMeasure(false);
    const go = holdMotion();
    await finish();
    await go();
    await advance(P7_T.flyAt + 10);
    await advance(P7_T.fade + 50);
    expect(big()).toBeNull();
  });

  test('180ms 전에 건너뛰면 그때 1회, 그 뒤 건너뛰어도 더 울리지 않는다', async () => {
    jest.useFakeTimers();
    stubMeasure(true);
    const go = holdMotion();
    await finish();
    await go();
    await advance(50);
    expect(vibrate).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('p7-stage'));
    await advance(10);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(big()).toBeNull();
    await advance(2000);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  test('측정을 기다리는 사이 화면을 떠나도 연출을 이어 가지 않는다(언마운트 정리)', async () => {
    jest.useFakeTimers();
    let resolveMeasure: (b: Box | null) => void = () => {};
    setMeasureForTest(() => new Promise(r => (resolveMeasure = r)));
    const go = holdMotion();
    await finish();
    await go();
    await advance(P7_T.flyAt + 10); // 측정 대기 중
    await press('알겠어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await act(async () => resolveMeasure({x: 0, y: 0, w: 120, h: 120}));
    await advance(2000);
    expect(screen.queryByTestId('p7-stage')).toBeNull();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});

test('첫 1회 안내는 하단 독(버튼 아래)에, 끝나도 자리는 남고 글자만 투명(본문이 움직이지 않음)', async () => {
  await finish();
  const hint = await waitFor(() => screen.getByTestId('p7-skip-hint'), {timeout: 3000});
  expect(within(screen.getByTestId('screen-dock')).getByTestId('p7-skip-hint')).toBeTruthy();
  expect(hint).toHaveTextContent('화면을 누르면 바로 넘어가요');
  fireEvent.press(screen.getByTestId('p7-stage'));
  await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId('p7-skip-hint').props.style).opacity).toBe(0));
  expect(await prefs.skipHintSeen()).toBe(true);
});

test('건너뛰기 안내는 이미 봤으면 다시 나오지 않는다', async () => {
  await prefs.markSkipHintSeen();
  await finish();
  expect(screen.queryByTestId('p7-skip-hint')).toBeNull();
});

test('제목은 첫 프레임부터 보이고(감사 M9, 페이드 묶음 밖), 둘째 줄만 처음엔 투명, 판정 전에는 시작하지 않는다', async () => {
  const go = holdMotion();
  await finish();
  const group = () => screen.getByTestId('p7-text');
  expect(within(group()).queryByText('오늘 코스를 마쳤어요')).toBeNull();
  expect(screen.getByTestId('p7-title')).toBeTruthy();
  expect(within(group()).getByText(/도장을 찍었어요|오늘 첫 도장을 찍었어요/)).toBeTruthy();
  expect(StyleSheet.flatten(group().props.style).opacity).toBe(0);
  expect(vibrate).not.toHaveBeenCalled(); // 동작 줄이기 판정 전: 아무 연출도 시작하지 않음
  await go();
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1), {timeout: 3000});
});

test('동작 줄이기: 120 도장이 제자리에서 200ms 페이드(이동·인주 없음), 오늘 칸은 이미 찍힘, 촉각은 유지', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await finish();
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(big()).toBeTruthy();
  expect(screen.queryByTestId('p7-ink', {includeHiddenElements: true})).toBeNull();
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
  expect(screen.queryByTestId('p7-skip-hint')).toBeNull();
  await new Promise<void>(r => setTimeout(() => r(), P7_T.fade + 100));
  expect(big()).toBeTruthy(); // 제자리에 남는다
});

test('도장 소리를 끄면 소리 없이 촉각만', async () => {
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
  await waitFor(() => screen.getByTestId('p7-stamp-big', {includeHiddenElements: true}));
  fireEvent.press(screen.getByTestId('p7-stage'));
  await waitFor(() => screen.getByText(/번호를 받으면 그때부터 고른 답이 가족에게 보여요/));
  expect(vibrate).toHaveBeenCalledTimes(1);
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
});

describe('P3 단계 체크 모션', () => {
  test('단계를 마치고 코스 홈이 다시 포커스된 뒤 그 행만 체크 모션, 다음 행은 테이프(처음 열 때는 없음)', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    expect(screen.queryByTestId('step-check-anim', {includeHiddenElements: true})).toBeNull();
    expect(screen.queryByTestId('step-tape-anim', {includeHiddenElements: true})).toBeNull();
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => expect(screen.getAllByTestId('step-check-anim', {includeHiddenElements: true})).toHaveLength(1));
    expect(screen.getAllByTestId('step-tape-anim', {includeHiddenElements: true})).toHaveLength(1);
    expect(vibrate).not.toHaveBeenCalled(); // 단계 체크에는 진동·소리 없음
    expect(play).not.toHaveBeenCalled();
  });
  test('동작 줄이기 판정 전(첫 프레임)에는 체크 모션을 시작하지 않는다', async () => {
    let resolveReduce: (v: boolean) => void = () => {};
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise(r => (resolveReduce = r)));
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => screen.getByTestId('step-check-anim', {includeHiddenElements: true}));
    // 판정 전: 체크는 아직 보이지 않는다(투명), 판정 뒤 시작
    expect(StyleSheet.flatten(screen.getByTestId('step-check-anim', {includeHiddenElements: true}).props.style).opacity).toBe(0);
    await act(async () => resolveReduce(true));
  });
});

describe('설정 도장 소리 토글(P13)', () => {
  test('"도장 소리" 스위치(기본 켜짐), 행 전체를 눌러도 바뀌고 저장, 위험 구역(모두 지우기)보다 위', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    const row = await waitFor(() => screen.getByRole('switch', {name: '도장 소리'}));
    await waitFor(() => expect(screen.getByRole('switch', {name: '도장 소리'}).props.accessibilityState?.checked).toBe(true));
    expect(row.props.accessibilityHint).toBe('도장을 찍을 때 짧은 소리');
    expect(StyleSheet.flatten(screen.getByTestId('sfx-row').props.style).minHeight).toBeGreaterThanOrEqual(64);
    fireEvent.press(screen.getByTestId('sfx-row'));
    await waitFor(async () => expect(await prefs.sfxEnabled()).toBe(false));
    expect(screen.getByRole('switch', {name: '도장 소리'}).props.accessibilityState?.checked).toBe(false);
    // 위치: 모두 지우기 위
    const ids = screen.UNSAFE_root.findAll(n => n.props?.testID === 'sfx-row' || n.props?.testID === 'settings-row-delete').map(n => n.props.testID);
    expect(ids.indexOf('sfx-row')).toBeLessThan(ids.indexOf('settings-row-delete'));
    expect(ids.indexOf('sfx-row')).toBeGreaterThanOrEqual(0);
    expect(screen.UNSAFE_getAllByType(Switch)).toHaveLength(1);
  });
  test('저장값을 읽기 전에는 스위치를 그리지 않는다(켜짐→꺼짐 깜빡임 없음)', async () => {
    await prefs.setSfxEnabled(false);
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    await waitFor(() => expect(screen.getByRole('switch', {name: '도장 소리'}).props.accessibilityState?.checked).toBe(false));
  });
});
