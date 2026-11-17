import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {photoSize, PHOTO_RATIO, DEFAULT_PHOTO_W, polaroidTotalH} from '../src/features/link/polaroidLayout';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 390, height: 844, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

const measure = (w: number, h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: w, height: h}}});
  });
const photo = () => StyleSheet.flatten(screen.getByTestId('intro-photo').props.style);

test('계산: 높이에서 틀·캡션·AI 표기·여백을 뺀 만큼, 폭은 비율(최대 영역 폭 50%)', () => {
  const big = photoSize(328, 400, 1)!;
  expect(big.w).toBe(164); // 50% 상한
  expect(Math.abs(big.w / big.h - PHOTO_RATIO)).toBeLessThan(0.02);
  // S25(360x780dp) 실측 근처: 소개 아래~질문 위 150~175
  for (const h of [150, 160, 175]) {
    const p = photoSize(312, h, 1)!;
    expect(p).not.toBeNull();
    expect(polaroidTotalH(p, 1)).toBeLessThanOrEqual(h); // 캡션·AI 표기까지 영역 안
  }
});

test('최소 72 로도 안 들어가면 숨긴다(잘리는 것보다 낫다)', () => {
  expect(photoSize(312, 100, 1)).toBeNull();
});

test('측정 전(0)에도 숨기지 않고 기본 크기로 그린다', () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(photo().width).toBe(DEFAULT_PHOTO_W);
});

test('측정되면 실제 영역으로 크기를 바꾼다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 330);
  const expected = photoSize(328, 330, 1)!;
  expect(photo().width).toBe(expected.w);
  expect(photo().height).toBe(expected.h);
});

test('영역이 너무 작으면(1.3 미만이어도) 숨긴다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 60);
  expect(screen.queryByTestId('intro-photo')).toBeNull();
});

test('S25 측정값(312x160)으로 그리면 틀 전체 높이가 영역 안', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 160);
  const p = photoSize(312, 160, 1)!;
  expect(photo().width).toBe(p.w);
  expect(polaroidTotalH(p, 1)).toBeLessThanOrEqual(160);
});

test('사진은 영역 위에 띄워(absolute) 영역 크기를 밀지 않는다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 160);
  const area = screen.getByTestId('polaroid-area');
  expect(StyleSheet.flatten(area.props.style).minHeight).toBe(0);
  const pinned = screen.getByTestId('polaroid-pinned');
  expect(StyleSheet.flatten(pinned.props.style).position).toBe('absolute');
});

test('글자 배율 1.3 이상이면 숨긴다', async () => {
  mockFontScale = 1.3;
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 400);
  expect(screen.queryByTestId('intro-photo')).toBeNull();
});

test('본문은 스크롤하지 않고 워드마크·소개가 보인다', () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  expect(screen.getByText('가화만사성')).toBeTruthy();
  expect(screen.getByText('하루 한 장, 우리 집 앨범', {includeHiddenElements: true})).toBeTruthy();
});

test('캡션 글자 크기는 사진 폭의 약 12%(12~18), 한 줄에 다 들어가면 표시·아니면 숨김', () => {
  const {captionFont, captionFits} = require('../src/features/link/polaroidLayout');
  expect(captionFont(72)).toBe(12);
  expect(captionFont(102)).toBe(12);
  expect(captionFont(140)).toBe(17);
  expect(captionFont(300)).toBe(18);
  expect(captionFits('마을 입구 나무', 90)).toBe(true); // 7em x 12 = 84
  expect(captionFits('마을 입구 나무', 72)).toBe(false); // 최소 크기 사진이면 숨김
  expect(captionFits('아주 아주 긴 사진 제목이 들어가는 경우', 72)).toBe(false);
});

test('캡션은 말줄임 없이 전체 표시 또는 숨김(AI 표기는 유지)', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(312, 160);
  const cap = screen.getByText('마을 입구 나무');
  expect(cap.props.numberOfLines).toBeUndefined();
  expect(cap.props.ellipsizeMode).toBeUndefined();
  // 실기기에서 두 줄 이상이 되면 숨긴다
  await act(async () => {
    fireEvent(cap, 'textLayout', {nativeEvent: {lines: [{}, {}]}});
  });
  expect(screen.queryByText('마을 입구 나무')).toBeNull();
  expect(screen.getByTestId('intro-ai-label')).toBeTruthy();
});
