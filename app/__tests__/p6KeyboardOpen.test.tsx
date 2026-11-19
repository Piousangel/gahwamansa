// S25 실기기 버그(11-19, 사용자 캡처): P6 자판을 열면 ① 위 카드가 제목 밑으로 잘리고 ② 입력 칸 안내가 "여기를 누르면 자..."로 말줄임되고
// ③ '‹ 오늘 코스' 뒤로 링크가 작다. 원인: 자판이 열려 본문이 낮아졌는데 카드(사진·칸 52·읽어 주기 64)·제목·입력 칸이 그대로라 넘쳐
// 스크롤이 입력 칸 쪽으로 밀렸다(카드 윗부분이 제목 밑으로 가려 보임). 안내는 34 글자 placeholder 라 한 줄에서 말줄임됐다.
// PR #14 리뷰: placeholder 대신 칸 위 글(M1, v4 2-8), 열림 동안은 배율과 상관없이 단계 제목 숨김(M2, v4 2-5).
// jest 는 실제 높이를 잴 수 없다 — "넘치지 않음"은 실기기·Maestro 캡처(320×640·200%, S25 1.3·1.5·2.0)로 확인한다(v4 4절).
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
});

async function toP6() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  return waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
}

test('자판 닫힘: 안내는 입력 칸 위 글(여러 줄 가능)로, 입력 칸은 비운 한 줄(placeholder·multiline 없음), 읽기는 힌트로', async () => {
  const input = await toP6();
  expect(input.props.placeholder).toBeUndefined();
  expect(input.props.multiline).toBeFalsy();
  expect(input.props.accessibilityHint).toBe('여기를 누르면 자판이 나와요');
  expect(screen.getByTestId('kb-hint', {includeHiddenElements: true})).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId('kb-hint', {includeHiddenElements: true}).props.style).height).toBeUndefined();
  const st = StyleSheet.flatten(input.props.style);
  expect(st.height).toBeUndefined();
  expect(st.minHeight).toBeGreaterThanOrEqual(64);
});

for (const scale of [1, 1.3, 2]) {
  test(`자판 열림(글자 ${scale * 100}%): 단계 제목 숨김(배율 무관), 카드 납작(사진·읽어 주기 없음·칸 44), 안내 글 접음 → 닫으면 원래대로`, async () => {
    mockFontScale = scale;
    const input = await toP6();
    expect(screen.getByLabelText('자판으로 쓰기, 3단계 중 3단계')).toBeTruthy();
    await act(async () => {
      fireEvent(input, 'focus');
    });
    expect(screen.queryByLabelText('자판으로 쓰기, 3단계 중 3단계')).toBeNull();
    expect(screen.queryByRole('button', {name: '읽어 주세요'})).toBeNull();
    expect(screen.queryByTestId('kb-hint', {includeHiddenElements: true})).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('kb-card').props.style).padding).toBe(8);
    expect(StyleSheet.flatten(screen.getByTestId('kb-cell-0').props.style).width).toBe(44);
    await act(async () => {
      fireEvent(input, 'blur');
    });
    expect(screen.getByLabelText('자판으로 쓰기, 3단계 중 3단계')).toBeTruthy();
    expect(screen.getAllByRole('button', {name: '읽어 주세요'})).toHaveLength(1);
  });
}

test('‹ 오늘 코스 뒤로 링크: 누름 영역 64 이상(높이·폭), 글자 24(고친 값)', async () => {
  await toP6();
  const back = screen.getByRole('button', {name: '오늘 코스로 돌아가기'});
  const st = StyleSheet.flatten(typeof back.props.style === 'function' ? back.props.style({pressed: false}) : back.props.style);
  expect(st.minHeight).toBeGreaterThanOrEqual(64);
  expect(st.minWidth).toBeGreaterThanOrEqual(64);
  expect(StyleSheet.flatten(screen.getByText('‹ 오늘 코스').props.style).fontSize).toBeGreaterThanOrEqual(24);
});
