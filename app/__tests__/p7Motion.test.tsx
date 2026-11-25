import React from 'react';
import {AccessibilityInfo, StyleSheet, Switch} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {createStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {P7_T} from '../src/features/course/CourseDone';
import {kstWeekdayIndex} from '../src/features/course/stamps';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';
import {setWeekStripForTest as setWeekStripForO6} from '../src/features/course/WeekStampStrip';
import {setupWarmAppRoot} from '../testUtils/warm';

// RN jest 기본 화면 값은 글자 2배라 P7 이 '본문 먼저'(1.6 이상, #263) 분기로 들어간다. 이 파일은 시안 타임라인(마운트 먼저)을 보므로 100%로 고정한다.
// 본문 먼저일 때의 도장 때는 p7BodyFirst200.test
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: 1}),
}));

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();
// 오너 결정 O-6(11-20)으로 도장 줄은 기본 꺼짐. 이 파일은 줄이 켜진 때의 동작(컴포넌트는 남김)을 검사하므로 켜고 시작한다
beforeEach(() => setWeekStripForO6(true));
afterEach(() => setWeekStripForO6(null));

// P7 완료 앨범(시안 P7_album_ds4 + 디자인 #95): 0~300ms 사진·테이프 페이드 → 300ms 도장 1.3→1(180ms) → 480ms 촉각·소리 1회·눌림 70ms
// → 520ms 번짐 원 .10→0(420ms) → 700ms 본문 둘째 줄 300ms 페이드. 제목·'알겠어요'는 첫 프레임부터. 동작 줄이기·화면 읽기면 모두 즉시.
// 건너뛰기 안내는 없다(UX 깊이 V20 삭제, 연출 1초).
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
  jest.useRealTimers();
  jest.restoreAllMocks();
  // 프리셋의 이 함수들은 이미 jest.fn 이라 spyOn 이 같은 함수를 돌려주고 restoreAllMocks 가 구현을 되돌리지 않는다(리뷰 L6)
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

async function finish(opts: FakeOptions = {}) {
  await toHomeConsented(createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question'], ...opts}));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-mount'));
}
const today = kstWeekdayIndex();
const hidden = {includeHiddenElements: true};
const opacityOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style).opacity;
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

test('타임라인 값은 시안 P7_album_ds4 와 같다', () => {
  expect(P7_T).toEqual({mountFade: 300, stampAt: 300, land: 180, squash: 70, inkAt: 520, ink: 420, textAt: 700, text: 300});
});

test('판정 전엔 사진·도장·둘째 줄이 투명이고 제목·버튼은 보인다 → 480ms 에 촉각·소리 1회(도장이 닿을 때) → 끝나도 더 울리지 않는다', async () => {
  jest.useFakeTimers();
  const go = holdMotion();
  await finish();
  expect(screen.getByText('오늘 코스를 마쳤어요')).toBeTruthy();
  expect(screen.getByRole('button', {name: '알겠어요'})).toBeTruthy();
  expect(opacityOf('p7-mount-fade')).toBe(0);
  expect(opacityOf('p7-seal')).toBe(0);
  expect(opacityOf('p7-text')).toBe(0);
  expect(vibrate).not.toHaveBeenCalled(); // 판정 전: 아무 연출도 시작하지 않음
  await go();
  await advance(P7_T.stampAt + P7_T.land - 30);
  expect(vibrate).not.toHaveBeenCalled(); // 도장이 닿기 전
  await advance(60);
  expect(vibrate).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('p7-ink', hidden)).toBeTruthy();
  await advance(P7_T.textAt + P7_T.text + 500);
  expect(vibrate).toHaveBeenCalledTimes(1);
});

test('연출 중 화면을 떠나도 촉각·소리가 뒤늦게 울리지 않는다(언마운트 정리)', async () => {
  jest.useFakeTimers();
  const go = holdMotion();
  await finish();
  await go();
  await advance(100); // 도장 전
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await advance(2000);
  expect(vibrate).not.toHaveBeenCalled();
});

test('리뷰 L2: 이번 주 도장 응답을 기다리는 동안에도 사진·도장 연출은 시작하고(촉각 1회), 둘째 줄만 응답 뒤에 보인다', async () => {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']});
  const pending: ((w: unknown) => void)[] = []; // 코스 홈(아래 화면)도 같은 때 다시 부른다 → 모두 풀어 준다
  await toHomeConsented(api);
  jest.spyOn(api, 'getWeekStamps').mockImplementation(() => new Promise(r => pending.push(r as never)));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-mount'));
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1)); // 응답 없이도 도장이 찍혔다
  await waitFor(() => expect(opacityOf('p7-seal')).toBe(1));
  expect(opacityOf('p7-text')).toBe(0); // 둘째 줄은 아직
  await act(async () => pending.forEach(r => r({weekStart: '2026-11-16', doneDates: []})));
  await waitFor(() => expect(opacityOf('p7-text')).toBe(1));
});

test('동작 줄이기: 모두 즉시 끝 상태(번짐 원 없음), 촉각은 유지(움직임이 아님)', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await finish();
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(opacityOf('p7-mount-fade')).toBe(1);
  expect(opacityOf('p7-seal')).toBe(1);
  expect(opacityOf('p7-text')).toBe(1);
  expect(screen.queryByTestId('p7-ink', hidden)).toBeNull();
});

test('마운트: 캡션 두 줄 AI 고지(#95), 건너뛰기 안내 없음(V20), 칭찬·연속 숫자 없음, 오늘 칸 도장', async () => {
  await finish();
  expect(screen.getByTestId('p7-ai-caption')).toHaveTextContent(/AI가 만든 그림\s*실제 장소가 아니에요/);
  expect(screen.queryByTestId('p7-skip-hint')).toBeNull();
  expect(screen.queryByText('화면을 누르면 바로 넘어가요')).toBeNull();
  expect(screen.queryByText(/연속|잘하셨|최고|대단|\d+일째/)).toBeNull();
  expect(screen.getAllByTestId(`stamp-on-${today}`, hidden).length).toBeGreaterThan(0);
});

test('도장 소리를 끄면 소리 없이 촉각만', async () => {
  await prefs.setSfxEnabled(false);
  await finish();
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(play).not.toHaveBeenCalled();
});

test('미연결도 같은 연출(기기에 찍힘), 문구 11-7 #19', async () => {
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
  await waitFor(() => screen.getByTestId('p7-mount'));
  await waitFor(() => screen.getByText(/번호를 받으면 그때부터 고르신 답이 가족에게 보여요/));
  await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
  expect(screen.getAllByTestId(`stamp-on-${today}`, hidden).length).toBeGreaterThan(0);
});

describe('P3 단계 체크 모션', () => {
  test('단계를 마치고 코스 홈이 다시 포커스된 뒤 그 행만 체크 모션(처음 열 때는 없음, v4 는 테이프 없음)', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    expect(screen.queryByTestId('step-check-anim', {includeHiddenElements: true})).toBeNull();
    expect(screen.queryByTestId('step-tape-anim', {includeHiddenElements: true})).toBeNull();
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => expect(screen.getAllByTestId('step-check-anim', {includeHiddenElements: true})).toHaveLength(1));
    expect(screen.queryByTestId('step-tape-anim', {includeHiddenElements: true})).toBeNull(); // P3 v4: 지금 행 테이프 없음(시안 ds4b)
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
    expect(within(screen.getByTestId('sfx-row')).UNSAFE_getAllByType(Switch)).toHaveLength(1); // 행마다 스위치 하나(알림 행 2개는 따로)
  });
  test('저장값을 읽기 전에는 스위치를 그리지 않는다(켜짐→꺼짐 깜빡임 없음)', async () => {
    await prefs.setSfxEnabled(false);
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    await waitFor(() => expect(screen.getByRole('switch', {name: '도장 소리'}).props.accessibilityState?.checked).toBe(false));
  });
});
