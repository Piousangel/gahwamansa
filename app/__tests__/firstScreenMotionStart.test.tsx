import React from 'react';
import {AccessibilityInfo, Animated} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {resetFirstScreenMotion} from '../src/features/link/RoleSelect';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: 1}),
}));
beforeEach(() => {
  resetFirstScreenMotion();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const stackDurations = (timing: jest.SpyInstance) =>
  timing.mock.calls.map(c => (c[1] as {duration: number}).duration).filter(d => d === 500); // 인화 덮개(묶음 전용)

// 실기기 재현(17-first-D): 영역을 잰 커밋에서 묶음이 처음 마운트된다. 그 커밋의 effect 에서 바로 시작하면
// 네이티브 뷰가 아직 없어 투명하게 남았다. 이제 묶음 자신의 onLayout 뒤에만 시작해야 한다.
test('영역 측정 직후(묶음 마운트 커밋)에는 묶음 모션을 시작하지 않고, 묶음 onLayout 뒤에 시작한다', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 161}}});
  });
  expect(screen.getByTestId('intro-photo')).toBeTruthy(); // 실기기 로그와 같은 크기: 묶음은 그려짐
  expect(stackDurations(timing)).toHaveLength(0);
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-stack'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 200, height: 140}}});
  });
  expect(stackDurations(timing)).toHaveLength(1);
});

test('정상 경로에서는 2.5초 안전장치가 발동하지 않는다', async () => {
  jest.useFakeTimers();
  const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 161}}});
  });
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-stack'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 200, height: 140}}});
  });
  setValue.mockClear();
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(setValue).not.toHaveBeenCalledWith(1); // 안전장치(끝 상태 강제)가 돌지 않음
});

test('안전장치: 묶음 onLayout 이 오지 않으면 2.5초 뒤 끝 상태로 보인다', async () => {
  jest.useFakeTimers();
  const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 161}}});
  });
  setValue.mockClear();
  await act(async () => {
    jest.advanceTimersByTime(2600);
  });
  expect(setValue).toHaveBeenCalledWith(1);
});
