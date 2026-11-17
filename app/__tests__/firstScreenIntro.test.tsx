import React from 'react';
import {act, fireEvent, render, screen, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';

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

test('셋째 항목은 두 줄이 되어도 확정 문구(주어 "자녀가")를 유지한다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  const third = screen.getByText(INTRO[2], {includeHiddenElements: true});
  await act(async () => {
    fireEvent(third, 'textLayout', {nativeEvent: {lines: [{}, {}]}});
  });
  expect(screen.getByText(INTRO[2], {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByText('고른 답으로 취향을 알아 가요', {includeHiddenElements: true})).toBeNull();
  expect(third.props.numberOfLines).toBeUndefined();
});

test('AI 표기는 폴라로이드 틀 밖 아래 보조 글자, 틀 반경 3 이하·사진 반경 0', async () => {
  render(<AppRoot api={createFakeApi()} />);
  await measure(328, 400);
  const frame = screen.getByLabelText('옛날 사진 예시, AI가 만든 그림');
  const {StyleSheet} = require('react-native');
  expect(StyleSheet.flatten(frame.props.style).borderRadius).toBeLessThanOrEqual(3);
  expect(StyleSheet.flatten(screen.getByTestId('intro-photo').props.style).borderRadius ?? 0).toBe(0);
  const ai = screen.getByTestId('intro-ai-label');
  // 틀 안에 있지 않다
  expect(within(frame).queryByText('AI가 만든 그림', {includeHiddenElements: true})).toBeNull();
  expect(ai).toBeTruthy();
});

test('하단 고정 영역 아래 여백은 16 + inset 이상', async () => {
  const SafeArea = require('react-native-safe-area-context');
  const insets = SafeArea.useSafeAreaInsets as jest.Mock;
  const orig = insets.getMockImplementation();
  insets.mockImplementation(() => ({top: 24, bottom: 48, left: 0, right: 0}));
  render(<AppRoot api={createFakeApi()} />);
  const dock = screen.getByTestId('screen-dock');
  const {StyleSheet} = require('react-native');
  const pad = StyleSheet.flatten((dock.children[0] as unknown as {props: {contentContainerStyle: unknown}}).props.contentContainerStyle);
  expect(pad.paddingBottom).toBeGreaterThanOrEqual(16 + 48);
  insets.mockImplementation(orig);
});

test('셋째 줄은 마지막 세 어절을 붙여 "자녀가 / 취향을 알아 가요"로만 나뉜다', () => {
  const {keepTail} = require('../src/features/link/RoleSelect');
  expect(keepTail('고른 답으로 자녀가 취향을 알아 가요')).toBe('고른 답으로 자녀가 취향을\u00A0알아\u00A0가요');
});
