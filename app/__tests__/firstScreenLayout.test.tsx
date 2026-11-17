import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {polaroidLayout, PHOTO_RATIO} from '../src/features/link/polaroidLayout';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 390, height: 844, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

const fits = (l: NonNullable<ReturnType<typeof polaroidLayout>>, w: number, h: number) => {
  // 회전(-2도)한 틀의 바깥 상자까지 영역 안에 들어간다
  const rad = (2 * Math.PI) / 180;
  const bw = l.frameW * Math.cos(rad) + l.frameH * Math.sin(rad);
  const bh = l.frameW * Math.sin(rad) + l.frameH * Math.cos(rad);
  return bw <= w && bh <= h;
};

test('갤럭시 S25 상당(폭 342, 남은 높이 360): 가로형 비율 유지, 영역 안(회전 포함)', () => {
  const l = polaroidLayout(342, 360, 1)!;
  expect(l).not.toBeNull();
  expect(Math.abs(l.photoW / l.photoH - PHOTO_RATIO)).toBeLessThan(0.01);
  expect(l.photoW).toBeGreaterThan(l.photoH); // 세로로 늘어나지 않음
  expect(fits(l, 342, 360)).toBe(true);
});

test('높이가 모자라면 높이에 맞춰 줄어든다', () => {
  const wide = polaroidLayout(342, 600, 1)!;
  const short = polaroidLayout(342, 260, 1)!;
  expect(short.photoW).toBeLessThan(wide.photoW);
  expect(fits(short, 342, 260)).toBe(true);
});

test('작은 화면(남은 높이 150)이면 숨긴다', () => {
  expect(polaroidLayout(312, 150, 1)).toBeNull();
});

test('글자가 크면 캡션 칸이 커져 사진이 더 작아진다', () => {
  const a = polaroidLayout(342, 330, 1)!; // 높이가 좁아 높이에 맞춰지는 경우
  const b = polaroidLayout(342, 330, 1.3)!;
  expect(b.photoH).toBeLessThan(a.photoH);
  expect(fits(b, 342, 330)).toBe(true);
});

test('첫 화면: 본문은 스크롤하지 않고, 측정한 영역으로 사진 크기를 명시한다(위 워드마크·설명은 항상 보임)', async () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  expect(screen.getByText('가화만사성')).toBeTruthy();
  expect(screen.getByText('하루 한 장, 우리 집 앨범', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByTestId('intro-photo')).toBeNull(); // 재기 전에는 그리지 않음
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 342, height: 360}}});
  });
  const s = StyleSheet.flatten(screen.getByTestId('intro-photo').props.style);
  const expected = polaroidLayout(342, 360, 1, {maxPhotoW: 390 * 0.5, maxPhotoH: 844 * 0.22})!;
  expect(s.width).toBe(expected.photoW);
  expect(s.height).toBe(expected.photoH);
});

test('첫 화면: 남은 높이가 작으면 사진을 숨긴다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 120}}});
  });
  expect(screen.queryByTestId('intro-photo')).toBeNull();
  expect(screen.getByText('이 휴대폰은 누구 거예요?')).toBeTruthy();
});
