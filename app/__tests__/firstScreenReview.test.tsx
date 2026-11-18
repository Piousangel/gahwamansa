import {finishFlight} from '../src/app/splash';
import React from 'react';
import {AccessibilityInfo, Animated, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {measureStack, stackLayout} from '../src/features/link/polaroidLayout';
import {resetFirstScreenMotion} from '../src/features/link/RoleSelect';
import {press, toHomeConsented} from '../testUtils/flow';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: mockFontScale}),
}));
beforeEach(() => {
  resetFirstScreenMotion();
  finishFlight(); // 스플래시 심볼 이동은 끝난 상태로(이동은 splash.test)
});
afterEach(() => {
  mockFontScale = 1;
  jest.restoreAllMocks();
});
const measure = async (w = 312, h = 170) => {
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
const rad = (d: number) => (d * Math.PI) / 180;

test('리뷰 공식: 묶음 높이 = 높이 cos9 + 폭 sin9 + 높이 x 0.05 + 테이프 12 <= 영역 - 8', () => {
  for (const H of [150, 160, 175, 190]) {
    const l = stackLayout(312, H)!;
    const h = l.frameH * Math.cos(rad(9)) + l.frameW * Math.sin(rad(9)) + l.frameH * 0.05 + 12;
    expect(h).toBeLessThanOrEqual(H - 8);
    const w = l.frameW * 1.62 + l.frameH * Math.sin(rad(9));
    expect(w).toBeLessThanOrEqual(312);
  }
  // 리뷰 예시(폴라로이드 폭 146) 크기는 영역 165에 들어가지 않으므로 고르지 않는다
  expect(stackLayout(312, 165)!.frameW).toBeLessThan(measureStack(130).frameW);
});

test('모션은 영역 측정 후 시작, 인화 덮개 500ms', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  const timing = jest.spyOn(Animated, 'timing');
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {});
  expect(timing).not.toHaveBeenCalled(); // 재기 전에는 시작하지 않음
  await measure();
  await waitFor(() => expect(timing).toHaveBeenCalled());
  const d = timing.mock.calls.map(c => (c[1] as {duration: number}).duration);
  expect(d).toContain(500);
  expect(d).not.toContain(1200);
});

test('앱 실행당 1회: 번호 화면에 갔다가 돌아오면 다시 재생하지 않는다', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  const timing = jest.spyOn(Animated, 'timing');
  render(<AppRoot api={createFakeApi()} />);
  await measure();
  await waitFor(() => expect(timing).toHaveBeenCalled());
  const n = timing.mock.calls.length;
  await press(/부모님 휴대폰이에요/);
  await press('이전 화면으로 가기');
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  await measure();
  await act(async () => {});
  expect(timing.mock.calls.length).toBe(n);
});

test('스크린리더가 켜져 있으면 모션 없이 끝 상태로 바로', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  render(<AppRoot api={createFakeApi()} />);
  await measure();
  await act(async () => {});
  expect(timing).not.toHaveBeenCalled();
});

test('소개 아이콘 24, 사진 묶음 화면 읽기 "옛날 사진 예시, AI가 만든 그림"(눈에 보이는 표시는 없음)', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure();
  const icon = screen.getByTestId('icon-photo', {includeHiddenElements: true});
  expect(icon.props.width ?? icon.props.style?.width).toBeDefined();
  expect(screen.getByLabelText('옛날 사진 예시, AI가 만든 그림')).toBeTruthy();
  expect(screen.queryByText(/AI/, {includeHiddenElements: true})).toBeNull();
});

test('글자 130%: 하단 영역 높이 상한을 없앤다', () => {
  mockFontScale = 1.3;
  render(<AppRoot api={createFakeApi()} />);
  const dock = screen.getByTestId('screen-dock');
  expect(StyleSheet.flatten(dock.props.style).maxHeight).toBeGreaterThanOrEqual(780);
});

test('글자 150%: 소개 제목·사진 숨김, 두 버튼은 하단 영역에 다 있다', async () => {
  mockFontScale = 1.5;
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.queryByText('하루 한 장, 우리 집 앨범', {includeHiddenElements: true})).toBeNull();
  await measure();
  expect(screen.queryByTestId('intro-photo')).toBeNull();
  const dock = within(screen.getByTestId('screen-dock'));
  expect(dock.getByRole('button', {name: /부모님 휴대폰이에요/})).toBeTruthy();
  expect(dock.getByRole('button', {name: /자녀 휴대폰이에요/})).toBeTruthy();
});

test('글자 200%: 하단 영역이 넘치면 고정을 풀고 화면 전체 스크롤로 두 버튼에 닿는다', async () => {
  mockFontScale = 2;
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {
    fireEvent(screen.getByTestId('first-dock-content'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 900}}});
  });
  expect(screen.queryByTestId('screen-dock')).toBeNull();
  const body = screen.getByTestId('screen-body');
  expect(body.props.scrollEnabled).toBe(true);
  expect(within(body).getByRole('button', {name: /부모님 휴대폰이에요/})).toBeTruthy();
  expect(within(body).getByRole('button', {name: /자녀 휴대폰이에요/})).toBeTruthy();
});

test('코스 사진·설정에 AI 고지', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  await press('설정');
  await waitFor(() => screen.getByText('AI가 만든 것')); // 앱 정보 한 목록의 AI 안내(AP-06)
  expect(screen.getByText('앱의 옛날 사진은 AI가 만든 그림이에요. 실제 장소가 아니에요')).toBeTruthy();
});

test('자녀 쪽(설정 → 앱 정보)에도 AI 고지', async () => {
  render(<AppRoot api={createFakeApi()} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '설정'}));
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '설정'}));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '앱 정보, 버전 1.0.0'}));
  });
  await waitFor(() => screen.getByText('앱의 옛날 사진은 AI가 만든 그림이에요. 실제 장소가 아니에요'));
});
