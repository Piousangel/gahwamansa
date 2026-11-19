// P6 자판으로 쓰기 v4(시안 P6_P7_N1_P2_ds4b) — 자판 열림·배율별 배치.
// 전수 캡처 #104 ①(200% '오늘은 넘어갈게요' 글자 잘림) ②(360×640 100% 입력 칸이 Dock 아래로 밀림), 접근성 패널 r1/7 H(200% 자판 열림에서
// '쓸 낱말' 카드가 잘려 낱말을 외워 써야 함)를 시안 구조로 푼다:
// - 닫힘: 사진 띠(56) + 고지 → 안내·이유 → 낱말 카드(본보기 낱말 + 입력 칸). 큰 칸 묶음·읽어 주기 아래 공간을 쓰지 않아 입력 칸이 첫 화면에 든다.
// - 자판 열림: 위 영역은 BackLink 한 줄(접힘), 본문 맨 위가 낱말 카드 — 본보기 낱말은 입력 칸 바로 위, 글자 상한 1.5(fieldInput).
// - '오늘은 넘어갈게요'는 Dock 슬롯(넘치면 DsScreen 이 본문 끝으로 보냄, R-12) — Dock 안에서 글자가 잘리지 않는다.
// jest 는 실제 높이를 잴 수 없다 — 첫 화면에 드는지는 에뮬레이터 캡처(PR 본문)로 확인한다.
import React from 'react';
import {Keyboard, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));
let kbHandlers: Record<string, ((e?: unknown) => void)[]> = {};
beforeEach(() => {
  kbHandlers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: (e?: unknown) => void) => {
    (kbHandlers[ev] ??= []).push(fn);
    return {remove: () => {}};
  }) as never);
});
afterEach(() => {
  mockFontScale = 1;
  jest.restoreAllMocks();
});

async function toP6() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  return waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
}
const openKb = async (input: ReturnType<typeof screen.getByLabelText>) => {
  await act(async () => {
    fireEvent(input, 'focus');
    (kbHandlers.keyboardDidShow ?? []).forEach(f => f({endCoordinates: {height: 270}}));
  });
};

test('닫힘: 입력 칸은 비운 한 줄(placeholder·multiline 없음, 높이는 minHeight), 안내는 칸 위 글·읽기는 힌트, 본보기 낱말은 칸 바로 위', async () => {
  const input = await toP6();
  expect(input.props.placeholder).toBeUndefined();
  expect(input.props.multiline).toBeFalsy();
  expect(input.props.accessibilityHint).toBe('여기를 누르면 자판이 나와요');
  const st = StyleSheet.flatten(input.props.style);
  expect(st.height).toBeUndefined();
  expect(st.minHeight).toBeGreaterThanOrEqual(56);
  // 카드 안 순서: 본보기 낱말 → 입력 칸
  const card = screen.getByTestId('kb-card');
  const ids = card.findAll(n => ['kb-word', 'kb-input'].includes(n.props?.testID) && typeof n.type === 'string').map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['kb-word', 'kb-input']);
  // #104 ②: 큰 음절 칸 묶음 없음(쓰는 중)
  expect(screen.queryByTestId('kb-cell-0')).toBeNull();
});

for (const scale of [1, 1.3, 2]) {
  test(`자판 열림(글자 ${scale * 100}%): 위 영역 접힘(단계 제목 숨김), 본보기 낱말은 남고 상한 1.5(r1/7 H) → 닫으면 원래대로`, async () => {
    mockFontScale = scale;
    const input = await toP6();
    expect(screen.getByLabelText('낱말 쓰기, 3단계 중 3단계')).toBeTruthy();
    await openKb(input);
    expect(screen.queryByLabelText('낱말 쓰기, 3단계 중 3단계')).toBeNull();
    expect(screen.queryByRole('button', {name: '읽어 주세요'})).toBeNull();
    const word = screen.getByTestId('kb-word', {includeHiddenElements: true});
    expect(word.props.maxFontSizeMultiplier).toBe(1.5);
    expect(input.props.maxFontSizeMultiplier).toBe(1.5);
    await act(async () => {
      fireEvent(input, 'blur');
      (kbHandlers.keyboardDidHide ?? []).forEach(f => f());
    });
    expect(screen.getByLabelText('낱말 쓰기, 3단계 중 3단계')).toBeTruthy();
  });
}

test('#104 ①: 닫힘의 넘어가기는 Dock 슬롯(Button, 줄바꿈 허용 — 말줄임 없음)', async () => {
  await toP6();
  const dock = within(screen.getByTestId('screen-dock'));
  const skip = dock.getByRole('button', {name: '오늘은 넘어갈게요'});
  expect(skip).toBeTruthy();
  const label = within(skip).getByText('오늘은 넘어갈게요');
  expect(label.props.numberOfLines).toBeUndefined();
});

test('BackLink 오늘 코스로: 어르신 64 이상, 누르면 기록 없이 코스 홈', async () => {
  await toP6();
  const back = screen.getByRole('link', {name: '오늘 코스로'});
  const st = StyleSheet.flatten(typeof back.props.style === 'function' ? back.props.style({pressed: false}) : back.props.style);
  expect(st.minHeight).toBeGreaterThanOrEqual(64);
  await act(async () => fireEvent.press(back));
  await waitFor(() => screen.getByTestId('date-line'));
});

test('#104 ②: 사진 띠가 입력 칸을 첫 화면 밖으로 밀면 그 크기·배율에서는 사진 띠를 접는다(본보기 낱말은 카드에 그대로)', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  expect(screen.getByTestId('kb-photo')).toHaveTextContent('AI가 만든 그림 · 실제 장소가 아니에요'); // 리드 결정: 사진이 나오는 곳은 병기 한 줄
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  await act(async () => {
    lay('screen-body-area', 0, 424); // 접힘 = 424 − 띠 24 = 400
    lay('kb-card', 300, 150); // 칸 아래 끝 450 > 400
  });
  expect(screen.queryByTestId('kb-photo')).toBeNull();
  expect(screen.getByTestId('kb-word', {includeHiddenElements: true})).toBeTruthy();
});
