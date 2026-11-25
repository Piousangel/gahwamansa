// P6 자판으로 쓰기 v4(시안 P6_P7_N1_P2_ds4b) — 자판 열림·배율별 배치.
// 전수 캡처 #104 ①(200% '오늘은 넘어갈게요' 글자 잘림) ②(360×640 100% 입력 칸이 Dock 아래로 밀림), 접근성 패널 r1/7 H(200% 자판 열림에서
// '쓸 낱말' 카드가 잘려 낱말을 외워 써야 함)를 시안 구조로 푼다:
// - 닫힘(회의 11-25로 바뀜): 보기 판(사진 원본 비율 + 고지 + 본보기 낱말) → 쓰기 칸(안내 + 입력 칸). 이유 줄은 Dock. 큰 칸 묶음·읽어 주기 아래 공간을 쓰지 않아 입력 칸이 첫 화면에 든다.
// - 자판 열림: 위 영역은 BackLink 한 줄(접힘), 본문 맨 위가 낱말 카드 — 본보기 낱말은 입력 칸 바로 위, 글자 상한 1.5(fieldInput).
// - '오늘은 넘어갈게요'는 Dock 슬롯(넘치면 DsScreen 이 본문 끝으로 보냄, R-12) — Dock 안에서 글자가 잘리지 않는다.
// jest 는 실제 높이를 잴 수 없다 — 첫 화면에 드는지는 에뮬레이터 캡처(PR 본문)로 확인한다.
import React from 'react';
import {Keyboard, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

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

test('리드 결정(b): 200% 자판 열림이면 Dock 을 풀고 다 썼어요는 입력 칸 바로 아래, 자판이 닫히면 Dock 으로 돌아온다', async () => {
  mockFontScale = 2;
  const input = await toP6();
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '다 썼어요'})).toBeTruthy();
  await openKb(input);
  expect(screen.queryByTestId('screen-dock')).toBeNull();
  const inline = screen.getByTestId('kb-done-inline');
  expect(within(inline).getByRole('button', {name: '다 썼어요'})).toBeTruthy();
  // 순서: 카드(입력 칸) → 다 썼어요
  const ids = screen.root.findAll(n => typeof n.type === 'string' && ['kb-card', 'kb-done-inline'].includes(n.props?.testID)).map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['kb-card', 'kb-done-inline']);
  await act(async () => {
    (kbHandlers.keyboardDidHide ?? []).forEach(f => f());
    fireEvent(input, 'blur');
  });
  expect(screen.queryByTestId('kb-done-inline')).toBeNull();
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '다 썼어요'})).toBeTruthy();
});

test('#192 리뷰 L1: 200% 자판 열림에서 다 썼어요 아래 영문 안내가 첫 화면 끝에 걸치면 통째로 아래로', async () => {
  mockFontScale = 2;
  const input = await toP6();
  await openKb(input);
  await act(async () => {
    fireEvent.changeText(input, 'a'); // 로마자 → 영문 안내
  });
  const wrap = screen.getByTestId('kb-roman-wrap');
  await act(async () => {
    // 창 끝 300, '다 썼어요' 묶음은 200~272, 안내(2줄 60)는 288~348 → 걸침
    fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300 + 24}}});
    fireEvent(screen.getByTestId('screen-body-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300 + 24}}});
    fireEvent(screen.getByTestId('kb-done-inline'), 'layout', {nativeEvent: {layout: {x: 0, y: 200, width: 320, height: 72}}});
    fireEvent(wrap, 'layout', {nativeEvent: {layout: {x: 0, y: 288, width: 320, height: 60}}});
  });
  const mt = StyleSheet.flatten(screen.getByTestId('kb-roman-wrap').props.style)?.marginTop ?? 0;
  expect(mt).toBeGreaterThan(0);
});

test('100% 자판 열림은 Dock 그대로(결정 b 는 200%에서만)', async () => {
  const input = await toP6();
  await openKb(input);
  expect(screen.queryByTestId('kb-done-inline')).toBeNull();
  expect(within(screen.getByTestId('screen-dock')).getByRole('button', {name: '다 썼어요'})).toBeTruthy();
});

test("자판 '완료' 키 = 다 썼어요(한 글자 이상일 때만)", async () => {
  const input = await toP6();
  await openKb(input);
  await act(async () => {
    fireEvent(input, 'submitEditing');
  });
  expect(screen.queryByText('낱말을 한 번 더 볼까요?')).toBeNull(); // 빈칸이면 아무 일 없음
  await act(async () => {
    fireEvent.changeText(input, '가');
  });
  await act(async () => {
    fireEvent(input, 'submitEditing');
  });
  await waitFor(() => screen.getByText('낱말을 한 번 더 볼까요?'));
});

test('입력한 글자 위쪽이 잘리지 않는다 — 입력 칸은 줄높이를 고정하지 않고 세로 가운데(에뮬레이터 200% 실측: 글자 34×1.5=51 > 줄높이 44 라 위가 잘렸다)', async () => {
  const input = await toP6();
  const st = StyleSheet.flatten(input.props.style);
  expect(st.lineHeight).toBeUndefined();
  expect(st.textAlignVertical).toBe('center');
  expect(st.includeFontPadding).toBe(false); // 글꼴 여백을 빼야 200% 자판 열림에서 카드·버튼이 통째로 들어온다(#192 디자인 리뷰 M1, 실측)
  expect(st.fontSize).toBeGreaterThan(0);
});

test('닫힘: 입력 칸은 비운 한 줄(placeholder·multiline 없음, 높이는 minHeight), 안내는 칸 바로 위 이름표·읽기는 힌트, 본보기 낱말은 보기 판(회의 11-25)', async () => {
  const input = await toP6();
  expect(input.props.placeholder).toBeUndefined();
  expect(input.props.multiline).toBeFalsy();
  expect(input.props.accessibilityHint).toBe('나무를 써 보세요. 여기를 누르면 자판이 나와요');
  const st = StyleSheet.flatten(input.props.style);
  expect(st.height).toBeUndefined();
  expect(st.minHeight).toBeGreaterThanOrEqual(56);
  // 쓰기 칸 안 순서: 안내(보이는 이름표) → 입력 칸. 본보기 낱말은 위 보기 판에(p6Clarity 가 자세히)
  const card = screen.getByTestId('kb-card');
  const ids = card.findAll(n => ['kb-word', 'kb-guide', 'kb-input'].includes(n.props?.testID) && typeof n.type === 'string', {deep: true}).map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['kb-guide', 'kb-input']);
  expect(within(screen.getByTestId('kb-look')).getByTestId('kb-word', {includeHiddenElements: true})).toBeTruthy();
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

test('#104 ②(회의 11-25 판): 사진을 바닥(96)보다 줄여야 입력 칸이 첫 화면에 들면 사진을 접는다(본보기 낱말은 보기 판에 그대로)', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  await act(async () => {
    lay('screen-body-area', 0, 424); // 접힘 = 424 − 띠 24 = 400
    lay('kb-look', 0, 74);
    lay('kb-model', 12, 50);
    lay('kb-card', 90, 110);
  });
  // fit = 400 − 12 − 8 − 고지 어림 − 8 − 50 − 12 − 16 − 110 − 2 ≥ 96 → 사진
  expect(screen.getByTestId('kb-photo', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByTestId('kb-ai-notice')).toHaveTextContent('AI가 만든 그림·실제 장소가 아니에요'); // 리드 결정(가운뎃점 둘레 공백 없음 — Noto 재렌더 #162)
  await act(async () => {
    lay('kb-card', 90, 200); // 쓰기 칸이 커져 fit < 96
  });
  expect(screen.queryByTestId('kb-photo', {includeHiddenElements: true})).toBeNull();
  expect(screen.queryByTestId('kb-ai-notice')).toBeNull();
  expect(within(screen.getByTestId('kb-look')).getByTestId('kb-word', {includeHiddenElements: true})).toBeTruthy();
});
