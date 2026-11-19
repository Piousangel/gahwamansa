import React from 'react';
import {AccessibilityInfo, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {StepRow} from '../src/ui/StepRow';
import {createPrefs, setPrefsForTest, type Prefs} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {confirmDeleteAll, press, pressBackLink, pressCourseNext, toHomeConsented} from '../testUtils/flow';

// 글자 배율: jest 기본(2)과 같게 두고, 해님 크기 테스트만 바꾼다
let mockFontScale = 2;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 390, height: 844, scale: 3, fontScale: mockFontScale}),
}));

// 로드맵 L2 AP-10·AP-11·AP-12·AP-14 묶음.
let prefs: Prefs;
beforeEach(() => {
  prefs = createPrefs(memoryStore());
  setPrefsForTest(prefs);
  setLocalStampsForTest(createLocalStamps(memoryStore()));
});
afterEach(() => {
  mockFontScale = 2;
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  jest.restoreAllMocks();
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
  (AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

async function home(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

describe('AP-10 해님 첫 인사 1회(DECISIONS 11-17: 어르신 연결 직후 앨범 첫 화면)', () => {
  test('연결된 코스 홈을 처음 열면 해님 첫 만남 말풍선 "안녕하세요, 해님이에요", 다음부터는 없음', async () => {
    await home();
    await waitFor(() => screen.getByText('안녕하세요, 해님이에요'));
    expect(await prefs.firstGreetingSeen()).toBe(true);
    screen.unmount();
    await home();
    await new Promise<void>(r => setTimeout(() => r(), 30));
    expect(screen.queryByText('안녕하세요, 해님이에요')).toBeNull();
  });
  test('P3 v4(시안 ds4b): 해님 인사 카드 1개(해님 36 + 인사 + 세 가지를 차례로 해요), 진입 알림(live region) 없음', async () => {
    mockFontScale = 1;
    await home();
    const card = await waitFor(() => screen.getByTestId('first-greeting'));
    expect(within(card).getByTestId('icon-sun', {includeHiddenElements: true}).props.width).toBe(36);
    expect(card.props.accessibilityLabel).toBe('안녕하세요, 해님이에요, 세 가지를 차례로 해요');
    expect(card.props.accessibilityLiveRegion).toBeUndefined();
  });
  test('글자 150% 이상이면 \'세 가지를 차례로 해요\'는 카드 밖 제목(시안 200% 보드)', async () => {
    mockFontScale = 1.5;
    await home();
    const card = await waitFor(() => screen.getByTestId('first-greeting'));
    expect(within(card).queryByText('세 가지를 차례로 해요')).toBeNull();
    expect(screen.getByRole('header', {name: '세 가지를 차례로 해요'})).toBeTruthy();
  });
  test('첫 단계를 시작했다 돌아오면 다시 나오지 않는다(그 방문 동안만)', async () => {
    await home();
    await waitFor(() => screen.getByTestId('first-greeting'));
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await pressBackLink();
    await waitFor(() => screen.getByTestId('date-line'));
    await new Promise<void>(r => setTimeout(() => r(), 30));
    expect(screen.queryByTestId('first-greeting')).toBeNull();
  });
  test('모두 지우기를 하면 기록도 지워 다음 계정이 다시 인사를 받는다', async () => {
    await home();
    await waitFor(() => screen.getByTestId('first-greeting'));
    expect(await prefs.firstGreetingSeen()).toBe(true);
    await press('설정');
    await press('모두 지우기');
    await waitFor(() => screen.getByText('모두 지울까요?'));
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('모두 지웠어요'));
    await waitFor(async () => expect(await prefs.firstGreetingSeen()).toBe(false));
  });
  test('미연결 열람에서는 인사하지 않는다(연결 직후에만)', async () => {
    render(<AppRoot api={createFakeApi()} />);
    await press(/부모님 휴대폰이에요/);
    await press('코스 보기');
    await waitFor(() => screen.getByTestId('course-strip'));
    await new Promise<void>(r => setTimeout(() => r(), 30));
    expect(screen.queryByText('안녕하세요, 해님이에요')).toBeNull();
    expect(await prefs.firstGreetingSeen()).toBe(false);
  });
});

describe('AP-11 포커스(D-10: 새로 들어오면 제목, 뒤로 돌아오면 떠날 때 누른 요소)', () => {
  const readerOn = () => (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(true));
  const labelOf = (c: unknown[]) => (c[0] as {props?: {accessibilityLabel?: string}})?.props?.accessibilityLabel;
  test('주 버튼으로 단계에 갔다가 뒤로 돌아오면 그 주 버튼으로 포커스', async () => {
    readerOn();
    await home();
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    send.mockClear();
    await pressBackLink();
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => expect(send.mock.calls.map(labelOf)).toContain('사진 보기'));
    expect(send.mock.calls.map(labelOf).at(-1)).toBe('사진 보기');
  });
  test('단계를 마치고 돌아오면 같은 자리 주 버튼(다음 단계 이름)으로', async () => {
    readerOn();
    await home();
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    send.mockClear();
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => expect(send.mock.calls.map(labelOf)).toContain('둘 중 고르기'));
  });
  test('화면 읽기 켜짐 + 단계 완료 복귀: 체크 모션과 주 버튼 포커스가 둘 다 실행된다(리뷰 l2 M1)', async () => {
    readerOn();
    await home();
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
    await press('다 봤어요');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => screen.getByTestId('step-check-anim', {includeHiddenElements: true}));
    await waitFor(() => expect(send.mock.calls.map(labelOf)).toContain('둘 중 고르기'));
  });
  test('설정에서 돌아오면 설정 링크로 포커스', async () => {
    readerOn();
    await home();
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await press('설정');
    await waitFor(() => screen.getByText('도장 소리'));
    send.mockClear();
    await press('돌아가기');
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => expect(send.mock.calls.map(labelOf)).toContain('설정'));
  });
  test('보기 전용 행에서 돌아오면 그 행으로', async () => {
    readerOn();
    render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul']})} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await press('둘 중 고르기, 했어요');
    await waitFor(() => screen.getByRole('button', {name: '돌아가기'}));
    send.mockClear();
    await press('돌아가기'); // 하단 '돌아가기'(v4: 보이는 글 = 읽기, 목적지는 힌트)
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(() => expect(send.mock.calls.map(labelOf)).toContain('둘 중 고르기, 했어요'));
  });
  test("화면 읽기가 꺼져 있으면 포커스를 옮기지 않는다", async () => {
    await home();
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await press('설정');
    await waitFor(() => screen.getByText('도장 소리'));
    await press('돌아가기');
    await waitFor(() => screen.getByTestId('date-line'));
    await new Promise<void>(r => setTimeout(() => r(), 1200));
    expect(send.mock.calls.map(labelOf)).not.toContain('설정'); // 앞 테스트의 남은 타이머와 섞이지 않게 이 화면 요소로만 본다
  });
  test("'다시 정하기'로 연 설정: 마지막 포커스는 화면 제목이 아니라 확인 제목", async () => {
    readerOn();
    render(<AppRoot api={createFakeApi({linked: true, consented: false})} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    await new Promise<void>(r => setTimeout(() => r(), 400));
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await press('다시 정하기');
    await waitFor(() => expect(send.mock.calls.map(labelOf)).toContain('오늘부터 고른 답이 가족에게 보여요'));
    await new Promise<void>(r => setTimeout(() => r(), 300));
    expect(send.mock.calls.map(labelOf).at(-1)).toBe('오늘부터 고른 답이 가족에게 보여요');
  });
});

describe('AP-12 지금 행 테이프: 고정 140×28 대신 라벨 뒤를 채우는 내용 크기(패딩 0 12, 높이 = 라벨 줄 높이, 왼쪽 −6)', () => {
  test('라벨 폭을 재면 테이프가 라벨 폭 + 24, 높이 28', async () => {
    render(<StepRow title="둘 중 고르기" status="now" statusLabel="지금 할 차례" />);
    await act(async () => {
      fireEvent(screen.getByTestId('step-now-label'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 110, height: 28}}});
    });
    const tape = screen.getByTestId('step-tape', {includeHiddenElements: true});
    expect(tape.props.width).toBe(134);
    expect(tape.props.height).toBe(28);
  });
  test('좁은 폭(320)·200%에서 라벨이 행보다 길어도 테이프가 행 밖으로 비치지 않는다(overflow hidden)', () => {
    render(<StepRow title="둘 중 고르기" status="now" statusLabel="지금 할 차례" />);
    expect(StyleSheet.flatten(screen.getByTestId('step-now-row').props.style).overflow).toBe('hidden');
  });
  test('글자 200%(줄 높이 56)면 테이프도 라벨 높이를 따른다', async () => {
    render(<StepRow title="둘 중 고르기" status="now" statusLabel="지금 할 차례" />);
    await act(async () => {
      fireEvent(screen.getByTestId('step-now-label'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 220, height: 56}}});
    });
    const tape = screen.getByTestId('step-tape', {includeHiddenElements: true});
    expect([tape.props.width, tape.props.height]).toEqual([244, 56]);
  });
});

describe('AP-14 테스트 보강', () => {
  test('설정 상태 문장은 행 이름과 함께 한 덩어리로 읽힌다', async () => {
    await home();
    await press('설정');
    await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주는 중이에요'));
  });
  test('모두 지우기 확인을 두 번 빨리 눌러도 삭제는 한 번', async () => {
    const api = await home();
    const del = jest.spyOn(api, 'deleteMyAccount');
    await press('설정');
    await press('모두 지우기');
    await waitFor(() => screen.getByText('모두 지울까요?'));
    await press('모두 지우기'); // P9 1단계 → 2단계 확인 상자
    const box = await waitFor(() => screen.getByTestId('delete-confirm2'));
    const btn = within(box).getByRole('button', {name: '모두 지우기'});
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => screen.getByText('모두 지웠어요'));
    expect(del).toHaveBeenCalledTimes(1);
  });
  test('동의 철회(설정 확인 버튼)를 두 번 빨리 눌러도 한 번', async () => {
    const api = createFakeApi({consented: true});
    const withdraw = jest.spyOn(api, 'withdrawConsent');
    await toHomeConsented(api);
    await press('설정');
    await press('그만 보여 주기');
    await waitFor(() => screen.getByText('가족에게 그만 보여 줄까요?'));
    const all = screen.getAllByRole('button', {name: '그만 보여 주기'});
    const btn = all[all.length - 1];
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => screen.getByLabelText('가족에게 답 보여 주기, 보여 주지 않는 중이에요'));
    expect(withdraw).toHaveBeenCalledTimes(1);
  });
  test('연결된 가족 그만두기 시트의 그만 보여 주기를 두 번 빨리 눌러도 한 번', async () => {
    const api = createFakeApi({consented: true, familyDates: ['2026-11-12']});
    const withdraw = jest.spyOn(api, 'withdrawConsent');
    await toHomeConsented(api);
    await press('설정');
    await press('연결된 가족');
    await press('그만두기, 답 보여 주기만 그만두거나, 모두 지울 수 있어요');
    const btn = screen.getByRole('button', {name: '그만 보여 주기, 지난 답은 지워져요. 연결은 그대로예요'});
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => screen.getByText('이제 고른 답은 가족에게 안 보여요. 설정에서 다시 보여 줄 수 있어요'));
    expect(withdraw).toHaveBeenCalledTimes(1);
  });
  test('콘텐츠가 없으면(null) "오늘 사진을 준비하고 있어요"와 다시 보기', async () => {
    const api = createFakeApi({linked: true, consented: true, empty: true});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByText('오늘 사진을 준비하고 있어요'));
    expect(screen.getByRole('button', {name: '다시 보기'})).toBeTruthy();
  });
  test('코스 홈을 떠난 뒤 늦게 온 도장 응답이 오류를 내지 않는다(언마운트 뒤 setState 없음)', async () => {
    const api = createFakeApi({linked: true, consented: true});
    let release: (v: {weekStart: string; doneDates: string[]}) => void = () => {};
    jest.spyOn(api, 'getWeekStamps').mockImplementation(() => new Promise(r => (release = r)));
    const errors = jest.spyOn(console, 'error');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    screen.unmount();
    await act(async () => release({weekStart: '2026-11-16', doneDates: []}));
    expect(errors.mock.calls.filter(c => String(c[0]).includes('unmounted'))).toHaveLength(0);
  });
});
