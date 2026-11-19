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
import {warmAppRoot} from '../testUtils/warm';

// 부하 때 흔들림(리드 11-20): 첫 AppRoot 렌더 테스트('단계 체크 시점')가 콜드 스타트를 혼자 떠안았다 → 파일 시작 때 예열
beforeAll(warmAppRoot);

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
  test('가려져(blur) 있는 동안 맡긴 일은 위 화면이 닫히는 전환 끝(closing=false)에 한 번 실행', () => {
    const nav = fakeNav();
    const run = jest.fn();
    const {result} = renderHook(() => useAfterTransition(nav as never));
    act(() => nav.emit('blur'));
    act(() => result.current(run));
    expect(run).not.toHaveBeenCalled();
    act(() => nav.emit('transitionEnd', {closing: true})); // 이 화면이 닫히는 전환: 무시
    expect(run).not.toHaveBeenCalled();
    act(() => nav.emit('transitionEnd', {closing: false}));
    expect(run).toHaveBeenCalledTimes(1);
    act(() => nav.emit('transitionEnd', {closing: false}));
    expect(run).toHaveBeenCalledTimes(1);
  });
  test('전환 이벤트가 오지 않으면 focus 뒤 600ms 에 실행', () => {
    jest.useFakeTimers();
    const nav = fakeNav();
    const run = jest.fn();
    const {result} = renderHook(() => useAfterTransition(nav as never));
    act(() => nav.emit('blur'));
    act(() => result.current(run));
    act(() => nav.emit('focus'));
    act(() => jest.advanceTimersByTime(599));
    expect(run).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(run).toHaveBeenCalledTimes(1);
  });
  test('focus 가 지나간 뒤(돌아오는 전환 중)에 맡겨도 전환 끝·폴백에 실행된다(영영 안 되는 빈틈 없음)', () => {
    jest.useFakeTimers();
    const nav = fakeNav();
    const run = jest.fn();
    const {result} = renderHook(() => useAfterTransition(nav as never));
    act(() => nav.emit('blur'));
    act(() => nav.emit('focus')); // 기록 반영보다 popTo 의 focus 가 먼저 온 경우
    act(() => result.current(run));
    expect(run).not.toHaveBeenCalled(); // isFocused() 였다면 여기서 바로 돌았다(리뷰 M1)
    act(() => jest.advanceTimersByTime(600));
    expect(run).toHaveBeenCalledTimes(1);
  });
  test('가려진 적이 없으면(이미 보이는 화면) 바로 실행', () => {
    const nav = fakeNav();
    const run = jest.fn();
    const {result} = renderHook(() => useAfterTransition(nav as never));
    act(() => result.current(run));
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('단계 체크 시점: 실제 흐름(리뷰 M1 증명)', () => {
  test('사진 보기를 마치고 코스 홈으로 돌아온 직후에는 체크 모션이 없고, 전환이 끝난 뒤(폴백 600ms) 시작', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByLabelText('사진 보기, 했어요'));
    expect(screen.queryByTestId('step-check-anim', {includeHiddenElements: true})).toBeNull(); // 전환 중: 아직 없음
    await waitFor(() => screen.getByTestId('step-check-anim', {includeHiddenElements: true}));
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
    await waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1)); // 연출이 시작됐다
    await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId('p7-text').props.style).opacity).toBe(1));
  });
  test('U5: 완료 문구 둘째 줄은 "내일 새 사진이 와요"(연결), 미연결은 11-7 #19 그대로', async () => {
    await finish();
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

describe('U-8(사용자 결정 11-19): P4·P5 하단 "오늘 코스로" 링크 삭제, 위 BackLink 가 대신', () => {
  test('사진 보기: 하단에 링크 없음, 위 BackLink 오늘 코스로(보이는 글 = 읽기) → 기록 없이 코스 홈', async () => {
    const api = createFakeApi({linked: true, consented: true});
    const rec = jest.spyOn(api, 'recordSessionStep');
    await toHomeConsented(api);
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    expect(screen.queryByTestId('to-course-home')).toBeNull();
    const back = screen.getByRole('link', {name: '오늘 코스로'});
    expect(within(screen.getByTestId('ds-screen-top')).getByTestId('back-link')).toBe(back);
    fireEvent.press(back);
    await waitFor(() => screen.getByTestId('date-line'));
    expect(rec).not.toHaveBeenCalled();
  });
  test('글자 150%에서도 BackLink 는 숨지 않는다(R-14)', async () => {
    mockFontScale = 1.5;
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    expect(screen.getByRole('link', {name: '오늘 코스로'})).toBeTruthy();
  });
});

describe('U8 설정 행 목록(시안 P13_more v2)', () => {
  test('구역 제목 가족·알림과 소리·앱, 안심 줄, 행 순서, 위험 행은 맨 아래', async () => {
    await toHomeConsented(createFakeApi({linked: true, consented: true}));
    await press('설정');
    await waitFor(() => screen.getByText('가족에게는 고른 답과 날짜가 보여요. 연결된 날과 답을 보여 주는 중인지도 보여요'));
    for (const h of ['가족', '알림과 소리', '앱']) {
      expect(screen.getByRole('header', {name: h})).toBeTruthy();
    }
    const order = ['가족에게 답 보여 주기, 보여 주는 중이에요', '연결된 가족', '도장 소리', '오픈소스 라이선스', '모두 지우기']; // 앱 구역은 앱 정보 한 목록(AP-06)
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
    const verb = screen.getByTestId('share-verb');
    expect(verb.props.accessibilityState?.expanded).toBe(false);
    await press('그만 보여 주기'); // W0 ②: 오른쪽 동사 버튼 → 행 아래 확인 펼침
    await waitFor(() => screen.getByText('가족에게 그만 보여 줄까요?'));
    expect(screen.getByTestId('share-verb').props.accessibilityState?.expanded).toBe(true);
    expect(within(screen.getByTestId('settings-row-share')).queryByTestId('icon-chevron-right', {includeHiddenElements: true})).toBeNull();
  });
});

describe('리뷰 낮음 반영', () => {
  test("W0 ③: 거부 상태 P3 띠 '다시 정하기' → 설정이 '다시 보여 주기' 확인을 펼친 채, 제목에 포커스, 좋아요 한 번이면 끝", async () => {
    // 첫 포커스는 Screen 이 화면 읽기가 켜져 있을 때만 옮긴다(AP-11: 시간 차 대신 Screen initialFocusRef 로 순서 보장)
    (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(true));
    const api = createFakeApi({linked: true, consented: false});
    const give = jest.spyOn(api, 'giveConsent');
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    await press('다시 정하기');
    await waitFor(() => screen.getByText('오늘부터 고른 답이 가족에게 보여요'));
    await waitFor(() =>
      expect(send.mock.calls.some(c => (c[0] as unknown as {props?: {accessibilityLabel?: string}})?.props?.accessibilityLabel === '오늘부터 고른 답이 가족에게 보여요')).toBe(true),
    );
    await press('좋아요');
    expect(give).toHaveBeenCalledTimes(1);
  });
  test('P3 v4 정정: 다 마치면 \'오늘 코스 다시 보기\' 보조 64 + 사진 아이콘', async () => {
    render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul']})} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    const btn = screen.getByRole('button', {name: '오늘 코스 다시 보기'});
    expect(StyleSheet.flatten(typeof btn.props.style === 'function' ? btn.props.style({pressed: false}) : btn.props.style).minHeight).toBe(64);
    expect(within(btn).getByTestId('icon-photo', {includeHiddenElements: true})).toBeTruthy();
  });
  test("설정: 보여 주기 행은 '›' 없음(같은 화면 확인), 보여 주지 않는 중이면 행 오른쪽 '다시 보여 주기'", async () => {
    render(<AppRoot api={createFakeApi({linked: true, consented: false})} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    await press('설정');
    const row = await waitFor(() => screen.getByTestId('settings-row-share'));
    expect(within(row).queryByTestId('icon-chevron-right', {includeHiddenElements: true})).toBeNull();
    await press('다시 보여 주기');
    await waitFor(() => screen.getByText('오늘부터 고른 답이 가족에게 보여요'));
  });
});
