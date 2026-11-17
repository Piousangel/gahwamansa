import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {stackLayout} from '../src/features/link/polaroidLayout';
import {resetFirstScreenMotion} from '../src/features/link/RoleSelect';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: 1}),
}));
beforeEach(() => resetFirstScreenMotion());

test('S25 실측 영역(328 x 140·150·160dp): 묶음이 보이고(숨김 아님) 전체가 영역 안', () => {
  for (const h of [140, 150, 160]) {
    const l = stackLayout(328, h);
    expect(l).not.toBeNull();
    expect(l!.totalW).toBeLessThanOrEqual(328);
    expect(l!.totalH).toBeLessThanOrEqual(h);
    expect(l!.photoW).toBeGreaterThanOrEqual(56);
  }
});

test('줄이는 순서: 넓으면 기본(9°/8°·펼침 31%·뒤 2장), 좁아질수록 회전·펼침·테이프·여유를 줄이고 마지막에 앞 1장', () => {
  const roomy = stackLayout(328, 260)!;
  expect([roomy.rotL, roomy.rotR, roomy.spread, roomy.single]).toEqual([9, 8, 0.31, false]);
  const tight = stackLayout(328, 140)!;
  expect(tight.rotL).toBeLessThanOrEqual(9);
  const tiny = stackLayout(328, 100);
  if (tiny) {
    expect(tiny.totalH).toBeLessThanOrEqual(100);
  }
  expect(stackLayout(328, 40)).toBeNull(); // 그래도 안 되면 숨김
});

test('화면: 150dp 영역에서 사진 묶음이 그려진다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 328, height: 150}}});
  });
  expect(screen.getByTestId('intro-photo')).toBeTruthy();
});
