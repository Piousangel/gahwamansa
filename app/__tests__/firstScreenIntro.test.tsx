import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {polaroidLayout} from '../src/features/link/polaroidLayout';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

const INTRO = ['옛날 사진 보며 추억을 떠올려요', '사진 속 낱말을 따라 써요', '고른 답으로 자녀가 취향을 알아 가요'];
const measure = async (w = 328, h = 300) =>
  act(async () => {
    fireEvent(screen.getByTestId('polaroid-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: w, height: h}}});
  });

test('소개: 워드마크 아래 제목 + 아이콘 달린 항목 3줄, 예전 한 줄 설명 없음', async () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByText('하루 한 장, 우리 집 앨범', {includeHiddenElements: true})).toBeTruthy();
  for (const t of INTRO) {
    expect(screen.getByText(t, {includeHiddenElements: true})).toBeTruthy();
  }
  for (const n of ['icon-photo', 'icon-pencil', 'icon-family']) {
    expect(screen.getByTestId(n, {includeHiddenElements: true})).toBeTruthy();
  }
  expect(screen.queryByText('옛날 사진 한 장으로 가족과 이야기를 나눠요')).toBeNull();
});

test('소개는 한 번에 읽힌다(제목. 항목1. 항목2. 항목3)', () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(
    screen.getByLabelText('하루 한 장, 우리 집 앨범. 옛날 사진 보며 추억을 떠올려요. 사진 속 낱말을 따라 써요. 고른 답으로 자녀가 취향을 알아 가요'),
  ).toBeTruthy();
});

test('사진은 보조: 사진 폭은 화면 폭의 50%, 높이는 화면 높이의 22% 이하', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 400);
  const img = screen.getByTestId('intro-photo');
  const s = Array.isArray(img.props.style) ? Object.assign({}, ...img.props.style) : img.props.style;
  expect(s.width).toBeLessThanOrEqual(360 * 0.5);
  expect(s.height).toBeLessThanOrEqual(780 * 0.22);
});

test('계산: 상한을 주면 상한을 넘지 않고 비율 유지', () => {
  const l = polaroidLayout(328, 400, 1, {maxPhotoW: 180, maxPhotoH: 171})!;
  expect(l.photoW).toBeLessThanOrEqual(180);
  expect(l.photoH).toBeLessThanOrEqual(171);
  expect(l.photoW).toBeGreaterThan(l.photoH);
});

test('남는 공간이 부족하면 사진부터 숨기고 소개는 남긴다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 90);
  expect(screen.queryByTestId('intro-photo')).toBeNull();
  expect(screen.getByText(INTRO[2], {includeHiddenElements: true})).toBeTruthy();
});

test('글자 130%: 사진을 먼저 숨기고 소개 3줄은 유지', async () => {
  mockFontScale = 1.3;
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 400);
  expect(screen.queryByTestId('intro-photo')).toBeNull();
  for (const t of INTRO) {
    expect(screen.getByText(t, {includeHiddenElements: true})).toBeTruthy();
  }
});

test('글자 150%: 소개 항목도 숨기고 제목·질문·버튼은 남긴다', async () => {
  mockFontScale = 1.5;
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 400);
  expect(screen.queryByText(INTRO[0], {includeHiddenElements: true})).toBeNull();
  expect(screen.getByText('하루 한 장, 우리 집 앨범', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByText('이 휴대폰은 누구 거예요?')).toBeTruthy();
});

test('셋째 항목이 두 줄로 넘치면 짧은 문구로 바꾼다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  const third = screen.getByText(INTRO[2], {includeHiddenElements: true});
  await act(async () => {
    fireEvent(third, 'textLayout', {nativeEvent: {lines: [{}, {}]}});
  });
  expect(screen.getByText('고른 답으로 취향을 알아 가요', {includeHiddenElements: true})).toBeTruthy();
});
