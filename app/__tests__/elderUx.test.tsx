import React from 'react';
import {AccessibilityInfo, NativeModules, StyleSheet} from 'react-native';
import {act, fireEvent, render, renderHook, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {StampRow} from '../src/features/course/StampRow';
import {useAfterTransition} from '../src/features/course/useAfterTransition';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {createStampFeedback, setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {color} from '../src/ui/tokens';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';

// 어르신 UX 승인안(DECISIONS 11-18, docs/design/v3/_qa/ux-improvements-2026-11-18.md) U5·U6·U8·U9·U13 + P7 후속.
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 390, height: 844, scale: 3, fontScale: mockFontScale}),
}));
let vibrate: jest.Mock;
beforeEach(() => {
  const prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
  vibrate = jest.fn();
  setStampFeedbackForTest(() =>
    createStampFeedback({player: null, vibrate, ringer: async () => 'normal', ttsSpeaking: () => false, prefs}),
  );
});
afterEach(() => {
  mockFontScale = 1;
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  setStampFeedbackForTest(null);
  delete (NativeModules as Record<string, unknown>).HapticModule;
  jest.useRealTimers();
  jest.restoreAllMocks();
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

describe('P7 후속: 단계 체크 시작은 전환이 끝난 뒤(transitionEnd closing=false)', () => {
  function fakeNav() {
    const listeners: Record<string, ((e: {data?: {closing?: boolean}}) => void)[]> = {};
    return {
      addListener: jest.fn((name: string, cb: (e: {data?: {closing?: boolean}}) => void) => {
        (listeners[name] ??= []).push(cb);
        return () => (listeners[name] = listeners[name].filter(x => x !== cb));
      }),
      emit: (name: string, data?: {closing?: boolean}) => (listeners[name] ?? []).forEach(cb => cb({data})),
    };
  }
  test('대기 중인 일은 다른 화면이 닫히며 이 화면이 드러난 전환 끝(closing=false)에 한 번 실행', () => {
    const nav = fakeNav();
    const run = jest.fn();
    const {result} = renderHook(() => useAfterTransition(nav as never));
    act(() => result.current(run));
    expect(run).not.toHaveBeenCalled();
    act(() => nav.emit('transitionEnd', {closing: true})); // 이 화면이 닫히는 전환: 무시
    expect(run).not.toHaveBeenCalled();
    act(() => nav.emit('transitionEnd', {closing: false}));
    expect(run).toHaveBeenCalledTimes(1);
    act(() => nav.emit('transitionEnd', {closing: false}));
    expect(run).toHaveBeenCalledTimes(1);
  });
  test('전환 이벤트가 오지 않으면(전환 없음·테스트) 포커스 뒤 600ms 에 실행', () => {
    jest.useFakeTimers();
    const nav = fakeNav();
    const run = jest.fn();
    const {result} = renderHook(() => useAfterTransition(nav as never));
    act(() => result.current(run));
    act(() => nav.emit('focus'));
    act(() => jest.advanceTimersByTime(599));
    expect(run).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('P7 후속', () => {
  async function finish() {
    await toHomeConsented(createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']}));
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByTestId('p7-stage'));
  }
  test('완료 해님 없음(디자인 결정), 인주 색은 brandSealDeep', async () => {
    await finish();
    const ink = screen.getByTestId('p7-ink', {includeHiddenElements: true});
    expect(StyleSheet.flatten(ink.props.style).backgroundColor).toBe(color.brandSealDeep);
    fireEvent.press(screen.getByTestId('p7-stage'));
    await waitFor(() => expect(screen.queryByTestId('p7-stamp-big', {includeHiddenElements: true})).toBeNull());
    expect(screen.queryByTestId('p7-sun', {includeHiddenElements: true})).toBeNull();
  });
  test('이번 주 도장 응답이 오지 않아도 제목·문구가 투명으로 남지 않는다(1.5초 뒤 진행)', async () => {
    const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']});
    jest.spyOn(api, 'getWeekStamps').mockImplementation(() => new Promise(() => {}));
    await toHomeConsented(api);
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByTestId('p7-stage'));
    await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1), {timeout: 4000}); // 연출이 시작됐다
    fireEvent.press(screen.getByTestId('p7-stage'));
    await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId('p7-text').props.style).opacity).toBe(1));
  });
  test('U5: 완료 문구 둘째 줄은 "내일 새 사진이 와요"(연결), 미연결은 11-7 #19 그대로', async () => {
    await finish();
    fireEvent.press(screen.getByTestId('p7-stage'));
    await waitFor(() => screen.getByText(/(도장을 찍었어요|오늘 첫 도장을 찍었어요)\.?\s*내일 새 사진이 와요/));
    expect(screen.queryByText(/내일 또 만나요/)).toBeNull();
  });
});

describe('U6 도장 줄: 지난 빈 날은 표시 없이, 오늘은 굵은 점선, 이후는 연한 점선', () => {
  test('수요일(2) 기준: 월 찍음, 화 지난 빈 날, 수 오늘, 목~일 이후', () => {
    render(<StampRow days={[true, false, false, false, false, false, false]} todayIdx={2} />);
    expect(screen.getByTestId('stamp-on-0', {includeHiddenElements: true})).toBeTruthy();
    expect(screen.getByTestId('stamp-past-1')).toBeTruthy();
    expect(screen.queryByTestId('stamp-empty-1')).toBeNull();
    const today = StyleSheet.flatten(screen.getByTestId('stamp-empty-2').props.style);
    const future = StyleSheet.flatten(screen.getByTestId('stamp-empty-3').props.style);
    expect(today.borderWidth).toBe(3);
    expect(future.borderColor).toBe(color.lineSoft);
    expect(future.borderStyle).toBe('dashed');
  });
});

describe('U9 키패드 촉각', () => {
  test('숫자·지움 키를 누를 때마다 시스템 키 촉각(KEYBOARD_TAP) 1회', async () => {
    const keyTap = jest.fn();
    (NativeModules as Record<string, unknown>).HapticModule = {confirm: jest.fn(), keyTap};
    render(<AppRoot api={createFakeApi()} role="parent" />);
    await waitFor(() => screen.getByLabelText('숫자 1'));
    fireEvent.press(screen.getByLabelText('숫자 1'));
    fireEvent.press(screen.getByLabelText('숫자 2'));
    fireEvent.press(screen.getByLabelText('한 칸 지우기'));
    expect(keyTap).toHaveBeenCalledTimes(3);
  });
});

describe('U13 단계 화면 하단 "오늘 코스로" 보조 링크(100%만)', () => {
  test('사진 보기 주 버튼 아래 링크, 누르면 기록 없이 코스 홈', async () => {
    const api = createFakeApi({linked: true, consented: true});
    const rec = jest.spyOn(api, 'recordSessionStep');
    await toHomeConsented(api);
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    const dock = screen.getByTestId('screen-dock');
    const link = within(dock).getByTestId('to-course-home');
    expect(within(link).getByText('오늘 코스로')).toBeTruthy();
    fireEvent.press(link);
    await waitFor(() => screen.getByTestId('date-line'));
    expect(rec).not.toHaveBeenCalled();
  });
  test('글자 150% 이상이면 넣지 않는다(하단 밀림 방지)', async () => {
    mockFontScale = 1.5;
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    expect(screen.queryByTestId('to-course-home')).toBeNull();
  });
});

describe('U8 설정 행 목록(시안 P13_more v2)', () => {
  test('구역 제목 가족·알림과 소리·앱, 안심 줄, 행 순서, 위험 행은 맨 아래', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    await waitFor(() => screen.getByText('가족에게는 고른 답과 날짜만 보여요'));
    for (const h of ['가족', '알림과 소리', '앱']) {
      expect(screen.getByRole('header', {name: h})).toBeTruthy();
    }
    const order = ['가족에게 답 보여 주기, 보여 주는 중이에요', '연결된 가족', '도장 소리', '앱 정보', '모두 지우기'];
    const labels = screen.UNSAFE_root
      .findAll(n => typeof n.props?.accessibilityLabel === 'string' && order.includes(n.props.accessibilityLabel) && n.props.accessibilityRole)
      .map(n => n.props.accessibilityLabel);
    const seen = [...new Set(labels)];
    expect(seen).toEqual(order);
    for (const id of ['settings-row-share', 'settings-row-family', 'sfx-row', 'settings-row-delete']) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(64);
    }
  });
  test('보여 주기 행을 누르면 확인(그만 보여 주기)이 열린다', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    await press('가족에게 답 보여 주기, 보여 주는 중이에요');
    await waitFor(() => screen.getByText('가족에게 그만 보여 줄까요?'));
  });
});
