import React from 'react';
import {AccessibilityInfo, Animated, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {stackLayout, PHOTO_RATIO} from '../src/features/link/polaroidLayout';
import {color} from '../src/ui/tokens';
import {resetFirstScreenMotion} from '../src/features/link/RoleSelect';

beforeEach(() => resetFirstScreenMotion());

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
  jest.restoreAllMocks();
});

const measure = async (w: number, h: number) => {
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: w, height: h}}});
  });
  // 묶음이 네이티브에 붙고 배치되면 onLayout 이 온다(모션은 그 뒤 시작)
  await act(async () => {
    const stack = screen.queryByTestId('polaroid-stack', {includeHiddenElements: true});
    if (stack) {
      fireEvent(stack, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 200, height: 140}}});
    }
  });
};

test('계산: 3장 묶음(앞 1장 + 뒤 2장 부채꼴) 전체가 S25 영역(150·160·175dp) 안', () => {
  for (const h of [150, 160, 175]) {
    const l = stackLayout(312, h)!;
    expect(l).not.toBeNull();
    expect(l.totalW).toBeLessThanOrEqual(312);
    expect(l.totalH).toBeLessThanOrEqual(h);
    expect(Math.abs(l.photoW / l.photoH - PHOTO_RATIO)).toBeLessThan(0.03);
  }
});

test('계산: 앞 사진 폭은 영역 폭의 44% 이하, 최소 72 미만이면 숨김', () => {
  expect(stackLayout(328, 600)!.frameW).toBeLessThanOrEqual(328 * 0.44);
  expect(stackLayout(312, 80)).toBeNull();
});

test('사진 3장, 캡션·AI 문구 없음, 화면 읽기 라벨은 "옛날 사진 앨범, AI가 만든 그림"', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 170);
  expect(screen.getByTestId('intro-photo')).toBeTruthy();
  expect(screen.getByTestId('intro-photo-back-left', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByTestId('intro-photo-back-right', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByLabelText('옛날 사진 앨범, AI가 만든 그림')).toBeTruthy();
  expect(screen.queryByText(/AI/, {includeHiddenElements: true})).toBeNull(); // 눈에 보이는 표시는 없음
  expect(screen.queryByText('마을 입구 나무', {includeHiddenElements: true})).toBeNull();
});

test('소개 아이콘은 색 원 안(노랑·하늘·복숭아, 지름 36)', () => {
  render(<AppRoot api={createFakeApi()} />);
  const bg = [color.accentSun, color.sky, color.accentPeach];
  for (let i = 0; i < 3; i++) {
    const s = StyleSheet.flatten(screen.getByTestId(`intro-icon-circle-${i}`, {includeHiddenElements: true}).props.style);
    expect(s.backgroundColor).toBe(bg[i]);
    expect(s.width).toBe(36);
    expect(s.borderRadius).toBe(18);
  }
});

test('모션: 처음 한 번 재생(심볼 450ms, 인화 500ms 포함), 버튼은 처음부터 누를 수 있다', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const timing = jest.spyOn(Animated, 'timing');
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByRole('button', {name: /부모님 휴대폰이에요/})).toBeEnabled();
  await measure(312, 170);
  await waitFor(() => expect(timing).toHaveBeenCalled());
  const durations = timing.mock.calls.map(c => (c[1] as {duration: number}).duration);
  expect(durations).toEqual(expect.arrayContaining([450, 300, 500]));
  for (const c of timing.mock.calls) {
    expect((c[1] as {useNativeDriver: boolean}).useNativeDriver).toBe(true);
  }
});

test('동작 줄이기: 움직임 없이 300ms 페이드만', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 170);
  await waitFor(() => expect(timing).toHaveBeenCalled());
  const durations = new Set(timing.mock.calls.map(c => (c[1] as {duration: number}).duration));
  expect([...durations]).toEqual([300]);
});

test('글자 배율 1.3 이상이면 사진 묶음을 숨긴다', async () => {
  mockFontScale = 1.3;
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 300);
  expect(screen.queryByTestId('intro-photo')).toBeNull();
});

test('본문은 스크롤하지 않고 워드마크·소개가 보인다', () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  expect(screen.getByText('가화만사성', {includeHiddenElements: true})).toBeTruthy();
});
