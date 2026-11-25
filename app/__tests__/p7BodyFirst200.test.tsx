// 대기열 33: 320×640 200%에서 P7 첫 화면에 제목만 보이던 문제.
// 원인(에뮬레이터 실측, docs/team/qa/evidence/2026-11-25-p7-200): 마운트 274(캡션 3줄 114) + 제목 97 이라 제목 뒤 남는 칸이 30이고,
// 본문(160)·「가족에게 건넸어요」(40)가 R-15 로 통째로 접힘 아래로 갔다.
// 고침: 글자 1.6배 이상(리드 결정 #263 QA-2 M1)이면 제목 → 본문 → 마운트로 순서만 바꾼다. 1.5 이하는 시안 순서(마운트 먼저) 그대로.
// 본문 먼저일 때 도장 촉각·소리는 본문이 나타나는 때(M2), 화면 밖 도장은 처음부터 찍힌 상태.
// jest 에는 레이아웃이 없어 onLayout 을 손으로 보내 접힘 계산을 본다(높이는 에뮬레이터 실측값).
import React from 'react';
import {StyleSheet} from 'react-native';
import {AccessibilityInfo} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {press, pressCourseNext} from '../testUtils/flow';
import {P7_MOUNT} from '../src/features/course/AlbumMount';
import {appCopy} from '../src/copy/copy';
import {P7_T} from '../src/features/course/CourseDone';
import {createStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 320, height: 640, scale: 2.75, fontScale: mockFontScale}),
}));

let vibrate: jest.Mock;
let play: jest.Mock;
beforeEach(async () => {
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
  vibrate = jest.fn();
  play = jest.fn();
  setStampFeedbackForTest(() => createStampFeedback({player: {playStamp: play}, vibrate, ringer: async () => 'normal', ttsSpeaking: () => false, prefs: p}));
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  setStampFeedbackForTest(null);
  mockFontScale = 1;
  jest.useRealTimers();
  jest.restoreAllMocks();
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

/** 3단계(스위치 꺼짐): ③ 쓰기를 넘겨 P7 */
async function toDone3() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-mount'));
}
/** 4단계(스위치 켜짐, 기획 v2.1 Q7): ④를 마치면 바로 P7 — ⑤ 없음 */
async function toDone4() {
  setFeature('fiveSteps', true);
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'recall', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByTestId('p7-mount'));
}
const ids = () =>
  screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && n.props.testID.startsWith('p7-item-') && typeof n.type === 'string').map(n => n.props.testID as string);
const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height: h}}});
const marginTop = (id: string): number => StyleSheet.flatten(screen.getByTestId(id, {includeHiddenElements: true}).props.style)?.marginTop ?? 0;

describe('배율별 배치', () => {
  // 경계(리드 결정 M1 = 1.6): 문턱을 1.51 로 내리면 1.59 가, 1.75 로 올리면 1.6 이 실패한다
  test.each([1, 1.5, 1.59])('글자 %s배: 시안 순서 그대로 — 마운트 → 제목 → 본문, 마운트 위 여백 8', async scale => {
    mockFontScale = scale;
    await toDone3();
    expect(ids()).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-text']);
    expect(marginTop('p7-mount')).toBe(P7_MOUNT.margin.top);
  });

  test.each([1.6, 1.8, 2])('글자 %s배: 제목 → 본문 → 마운트, 마운트 위 여백은 테이프·기울임 넘침보다 크게(20)', async scale => {
    mockFontScale = scale;
    await toDone3();
    expect(ids()).toEqual(['p7-item-title', 'p7-item-text', 'p7-item-mount']);
    expect(marginTop('p7-mount')).toBe(P7_MOUNT.margin.afterBody);
    expect(P7_MOUNT.margin.afterBody).toBeGreaterThan(-P7_MOUNT.tape.top); // 테이프(-12)가 마운트 칸 위로 나가지 않게
  });

  test('4단계 200%: 「가족에게 건넸어요」 줄 없이 3단계와 같은 순서(제목 → 둘째 줄 → 마운트)', async () => {
    mockFontScale = 2;
    await toDone4();
    expect(ids()).toEqual(['p7-item-title', 'p7-item-text', 'p7-item-mount']);
    expect(screen.queryByText('가족에게 건넸어요')).toBeNull();
  });

  test('200%에서도 마운트 안은 그대로: 272 폭·캡션은 법무 고지 두 문장(AI 표기 → 실제 장소 아님)', async () => {
    mockFontScale = 2;
    await toDone3();
    expect(StyleSheet.flatten(screen.getByTestId('p7-mount').props.style).width).toBe(P7_MOUNT.width.large);
    expect(screen.getByTestId('p7-ai-caption')).toHaveTextContent(new RegExp(`^${appCopy.ai_photo_label}\\s*${appCopy.not_real_place}$`));
  });
});

describe('R-15 (320×640 200% 실측 높이)', () => {
  // 접힘 = 본문 영역 470 − '더 있음' 띠 24 = 446, 묶음 위 끝 12. 높이: 제목 97·본문 160·마운트 287(위 여백 20 포함)
  test('3단계: 제목·본문은 첫 화면에 남고, 접힘에 걸친 마운트만 통째로 민다', async () => {
    mockFontScale = 2;
    await toDone3();
    await act(async () => {
      lay('screen-body-area', 0, 470);
      lay('p7-stage', 12, 0);
      lay('p7-item-title', 0, 97); // 12~109
      lay('p7-item-text', 0, 160); // 125~285 → 첫 화면
      lay('p7-item-mount', 0, 287); // 301~588 → 446 에 걸림
    });
    // 고치기 전(마운트 → 제목 → 본문): 본문이 413~573 으로 걸려 통째로 밀렸다(첫 화면에 제목만)
    expect(marginTop('p7-item-title')).toBe(0);
    expect(marginTop('p7-item-text')).toBe(0);
    expect(marginTop('p7-item-mount')).toBe(446 - 301 + 1); // 에뮬레이터 실측 146 과 같다
  });

});

describe('도장 촉각·소리 때 (리드 결정 M2)', () => {
  const hidden = {includeHiddenElements: true};
  const opacityOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style).opacity;
  const advance = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };
  // 동작 줄이기 판정을 붙잡아 연출 시작 시점을 테스트가 정한다(p7Motion 과 같은 방식)
  function holdMotion() {
    let release: (v: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise<boolean>(r => (release = r)));
    return async (reduce = false) => {
      await act(async () => release(reduce));
    };
  }

  test('1.5배(마운트 먼저): 지금대로 도장이 닿는 480ms 에 1회', async () => {
    mockFontScale = 1.5;
    jest.useFakeTimers();
    const go = holdMotion();
    await toDone3();
    await go();
    expect(opacityOf('p7-seal')).toBe(0); // 찍히기 전
    await advance(P7_T.stampAt + P7_T.land + 30);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    await advance(P7_T.textAt + P7_T.text + 500);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  test('1.6배(본문 먼저): 도장은 처음부터 찍힌 상태, 촉각·소리는 480ms 가 아니라 본문이 나타나는 700ms 에 1회', async () => {
    mockFontScale = 1.6;
    jest.useFakeTimers();
    const go = holdMotion();
    await toDone3();
    await go();
    expect(opacityOf('p7-seal')).toBe(1); // 스크롤해 내려가면 이미 찍혀 있다
    expect(opacityOf('p7-mount-fade')).toBe(1);
    await advance(P7_T.stampAt + P7_T.land + 30);
    expect(vibrate).not.toHaveBeenCalled(); // 화면 밖 도장이 닿는 때에는 울리지 않는다
    expect(opacityOf('p7-text')).toBe(0);
    await advance(P7_T.textAt - (P7_T.stampAt + P7_T.land + 30) + 10);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    await advance(P7_T.text + 1000);
    expect(opacityOf('p7-text')).toBe(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  test('200% 동작 줄이기: 모두 즉시, 촉각·소리 1회', async () => {
    mockFontScale = 2;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await toDone3();
    await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));
    expect(opacityOf('p7-seal')).toBe(1);
    expect(opacityOf('p7-text')).toBe(1);
  });
});
