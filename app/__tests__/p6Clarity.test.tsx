// P6 낱말 쓰기 영역 구분·사진 잘림(오너 S25 11-25, 팀 회의 docs/design/2026-11-25-p6-clarity/README.md).
// 결정: 보기 판(옅은 종이 면 — 사진 원본 비율 + AI 고지 + 따라 쓸 낱말) / 쓰기 칸(안내 = 보이는 이름표 + 입력 칸, 화면에 하나뿐인 테두리 상자).
// 「한 글자라도 쓰면 눌려요」는 본문이 아니라 Dock '다 썼어요' 위 이유 줄 + 힌트. 사진은 고정 띠(56) + cover 대신 원본 비율 contain,
// 높이는 입력 칸까지 첫 화면에 드는 높이(fit), 바닥 96 아래면 접는다. jest 에는 레이아웃이 없어 onLayout 을 직접 넣는다.
import React from 'react';
import {Keyboard, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';
import {LOOK_GAP, LOOK_PAD, P6_FIT_GAP, P6_PHOTO_MIN_H, p6PhotoFit} from '../src/features/course/KeyboardStep';
import {PHOTO_FIT_SLACK} from '../src/features/course/photoFrame';

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

const hidden = {includeHiddenElements: true};
async function toP6(realImage = true) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, realImage, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  return waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
}
const lay = (id: string, y: number, h: number, width = 312) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width, height: h}}});
/** 접힘(viewport) = 본문 창 − '더 있음' 띠 24 */
async function layout(viewport: number, card = 110, model = 50) {
  await act(async () => {
    lay('screen-body-area', 0, viewport + 24);
    lay('kb-look', 0, 74);
    lay('kb-model', 12, model);
    lay('kb-card', 90, card);
  });
}
const order = (ids: string[]) => [...new Set(screen.UNSAFE_root.findAll(n => typeof n.type === 'string' && ids.includes(n.props?.testID)).map(n => n.props.testID as string))];
const borderOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style)?.borderWidth ?? 0;

test('영역: 보기 판(본보기 낱말) → 쓰기 칸(안내 → 입력 칸). 테두리 상자는 입력 칸 하나뿐', async () => {
  await toP6();
  await layout(500);
  expect(order(['kb-look', 'kb-card'])).toEqual(['kb-look', 'kb-card']);
  const look = within(screen.getByTestId('kb-look'));
  expect(look.getByLabelText('따라 쓸 낱말, 나무')).toBeTruthy();
  expect(look.queryByTestId('kb-input')).toBeNull();
  const card = screen.getByTestId('kb-card');
  expect(within(card).queryByTestId('kb-word', hidden)).toBeNull(); // 낱말은 쓰기 칸 안이 아니다(제목·라벨 모호함 해소)
  expect(within(card).getByTestId('kb-guide')).toHaveTextContent('보이는 낱말을 아래 칸에 써요');
  expect(order(['kb-guide', 'kb-input'])).toEqual(['kb-guide', 'kb-input']);
  expect(borderOf('kb-look')).toBe(0);
  expect(borderOf('kb-card')).toBe(0);
  expect(borderOf('kb-input')).toBeGreaterThanOrEqual(2);
});

test('「한 글자라도 쓰면 눌려요」는 본문이 아니라 꺼진 「다 썼어요」 위 이유 줄·힌트. 한 글자 쓰면 사라진다', async () => {
  const input = await toP6();
  expect(within(screen.getByTestId('screen-body')).queryByText('한 글자라도 쓰면 눌려요', hidden)).toBeNull();
  const dock = within(screen.getByTestId('screen-dock'));
  expect(dock.getByText('한 글자라도 쓰면 눌려요', hidden)).toBeTruthy();
  expect(dock.getByRole('button', {name: '다 썼어요'}).props.accessibilityHint).toBe('한 글자라도 쓰면 눌려요');
  await act(async () => {
    fireEvent.changeText(input, '나');
  });
  expect(screen.queryByText('한 글자라도 쓰면 눌려요', hidden)).toBeNull();
  expect(dock.getByRole('button', {name: '다 썼어요'}).props.accessibilityHint).toBeUndefined();
});

test('화면 읽기 순서: AI 고지 → 따라 쓸 낱말 → 안내 → 입력 칸(사진 그림은 읽지 않음)', async () => {
  await toP6();
  await layout(500);
  expect(order(['kb-ai-notice', 'kb-model', 'kb-guide', 'kb-input'])).toEqual(['kb-ai-notice', 'kb-model', 'kb-guide', 'kb-input']);
  expect(screen.getByTestId('kb-photo', hidden).props.importantForAccessibility).toBe('no-hide-descendants');
  expect(screen.getByTestId('kb-input').props.accessibilityLabel).toBe('낱말 쓰는 칸');
});

test('사진 잘림 원인 고정: 고정 띠 + cover 가 아니라 원본 비율 contain. 높이는 입력 칸까지 첫 화면에 드는 fit', async () => {
  await toP6();
  await layout(400);
  await act(async () => {
    lay('kb-ai-notice-wrap', 0, 30);
  });
  const img = screen.getByTestId('kb-photo-image', hidden);
  expect(img.props.resizeMode).toBe('contain');
  await act(async () => {
    fireEvent(img, 'load', {nativeEvent: {source: {width: 1152, height: 928}}});
  });
  const fit = 400 - LOOK_PAD - LOOK_GAP - 30 - LOOK_GAP - 50 - LOOK_PAD - 16 - 110 - PHOTO_FIT_SLACK - P6_FIT_GAP; // 140
  const f = StyleSheet.flatten(screen.getByTestId('kb-photo', hidden).props.style);
  expect(f.height).toBe(fit);
  expect(Math.abs(f.width / f.height - 1152 / 928)).toBeLessThan(0.01); // 원본 비율(옛 띠는 312×56 = 5.6:1)
  // 넓은 창: 상한(창 45% = 288) 안이면 본문 폭(판 좌우 여백 0 — 고지 한 줄) 가득
  await layout(560);
  const g = StyleSheet.flatten(screen.getByTestId('kb-photo', hidden).props.style);
  expect(g.width).toBe(312);
  expect(Math.abs(g.width / g.height - 1152 / 928)).toBeLessThan(0.01);
});

test('#265 QA-2 M1: 사진을 넣어도 입력 칸 아래 끝과 접힘(\'더 있음\' 띠) 사이에 시각 여유 12 이상', async () => {
  await toP6();
  await layout(400);
  await act(async () => {
    lay('kb-ai-notice-wrap', 0, 30);
  });
  const h = StyleSheet.flatten(screen.getByTestId('kb-photo', hidden).props.style).height as number;
  // 보기 판 위 끝 0 → 여백 → 사진 → 간격 → 고지 → 간격 → 낱말 → 여백 → 본문 간격 16 → 쓰기 칸(110)
  const inputBottom = 0 + LOOK_PAD + h + LOOK_GAP + 30 + LOOK_GAP + 50 + LOOK_PAD + 16 + 110;
  expect(400 - inputBottom).toBeGreaterThanOrEqual(12);
  expect(h).toBeGreaterThanOrEqual(P6_PHOTO_MIN_H); // 여유를 둬도 이 창에서는 사진이 접히지 않는다
});

test('#265 QA-2 L1: 입력 칸 라벨은 그대로, 힌트에 따라 쓸 낱말(조사 자동)', async () => {
  const input = await toP6();
  expect(input.props.accessibilityLabel).toBe('낱말 쓰는 칸');
  expect(input.props.accessibilityHint).toBe('나무를 써 주세요. 여기를 누르면 자판이 나와요');
});

test('사진 준비 중(pending)이면 보기 판에 낱말만, AI 고지도 없다', async () => {
  await toP6(false);
  await layout(500);
  expect(screen.queryByTestId('kb-photo', hidden)).toBeNull();
  expect(screen.queryByTestId('kb-ai-notice', hidden)).toBeNull();
  expect(within(screen.getByTestId('kb-look')).getByLabelText('따라 쓸 낱말, 나무')).toBeTruthy();
});

for (const scale of [1, 2]) {
  test(`자판 열림(글자 ${scale * 100}%): 보기 판·안내는 접고, 쓰기 칸 한 줄에 본보기 낱말 → 입력 칸(키보드에 가리지 않게)`, async () => {
    mockFontScale = scale;
    const input = await toP6();
    await layout(500);
    await act(async () => {
      fireEvent(input, 'focus');
      (kbHandlers.keyboardDidShow ?? []).forEach(f => f({endCoordinates: {height: 270}}));
    });
    expect(screen.queryByTestId('kb-look')).toBeNull();
    expect(screen.queryByTestId('kb-guide')).toBeNull();
    const card = screen.getByTestId('kb-card');
    expect(StyleSheet.flatten(card.props.style).flexDirection).toBe('row');
    expect(order(['kb-word', 'kb-input'])).toEqual(['kb-word', 'kb-input']);
    expect(within(card).getByLabelText('따라 쓸 낱말, 나무')).toBeTruthy();
    // 자판 열림: 이유 줄은 없고 힌트로만(360×640 실측: 이유 줄이 있으면 자판 위 Dock 이 커져 입력 칸이 '더 있음' 띠에 가림)
    // 200%(Dock 풀림, 본문 '다 썼어요')도 같다 — 두 줄 이유가 버튼을 '더 있음' 띠 아래로 밀었다(320×640 실측)
    expect(screen.queryByText('한 글자라도 쓰면 눌려요', hidden)).toBeNull();
    expect(screen.getByRole('button', {name: '다 썼어요'}).props.accessibilityHint).toBe('한 글자라도 쓰면 눌려요');
  });
}

test('p6PhotoFit: 하나라도 못 쟀으면 undefined(사진을 아직 그리지 않음), 값은 사진과 무관한 실측만', () => {
  expect(p6PhotoFit({viewport: 0, lookTop: 0, notice: 30, model: 50, card: 110})).toBeUndefined();
  expect(p6PhotoFit({viewport: 400, notice: 30, model: 50, card: 110})).toBeUndefined();
  expect(p6PhotoFit({viewport: 400, lookTop: 0, notice: 30, card: 110})).toBeUndefined();
  expect(p6PhotoFit({viewport: 400, lookTop: 0, notice: 30, model: 50, card: 110})).toBe(140);
  expect(P6_FIT_GAP).toBe(12);
  expect(P6_PHOTO_MIN_H).toBe(96);
});

