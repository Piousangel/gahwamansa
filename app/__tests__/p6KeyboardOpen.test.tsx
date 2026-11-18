// S25 실기기 버그(11-19, 사용자 캡처): P6 자판을 열면 ① 위 카드가 제목 밑으로 잘리고 ② 입력 칸 안내가 "여기를 누르면 자..."로 말줄임되고
// ③ '‹ 오늘 코스' 뒤로 링크가 작다. 원인: 자판이 열려 본문이 낮아졌는데 카드(사진·칸 52·읽어 주기 64)와 한 줄 고정 입력 칸이 그대로라 넘쳐
// 스크롤이 입력 칸 쪽으로 밀렸다(카드 윗부분이 제목 밑으로 가려 보임). 입력 칸은 한 줄이라 34 글자 안내가 말줄임됐다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';

async function toP6() {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  return waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
}

test('자판 닫힘: 입력 칸 안내는 말줄임 없이 줄바꿈(multiline), 높이는 최소만', async () => {
  const input = await toP6();
  expect(input.props.multiline).toBe(true);
  expect(input.props.numberOfLines).toBeUndefined();
  expect(input.props.placeholder).toBe('여기를 누르면 자판이 나와요');
  const st = StyleSheet.flatten(input.props.style);
  expect(st.height).toBeUndefined();
  expect(st.minHeight).toBeGreaterThanOrEqual(64);
  expect(input.props.blurOnSubmit).toBe(true); // 줄바꿈 키 대신 마침(낱말 한 줄)
});

test('자판 열림: 카드가 납작해져(사진·읽어 주기 없음, 칸 44) 본문이 넘치지 않게, 안내 문구는 비운다', async () => {
  const input = await toP6();
  expect(screen.getAllByRole('button', {name: '읽어 주세요'})).toHaveLength(1);
  await act(async () => {
    fireEvent(input, 'focus');
  });
  expect(screen.queryByRole('button', {name: '읽어 주세요'})).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId('kb-card').props.style).padding).toBe(8);
  expect(StyleSheet.flatten(screen.getByTestId('kb-cell-0').props.style).width).toBe(44);
  expect(screen.getByLabelText('낱말 쓰는 칸').props.placeholder).toBeUndefined();
  await act(async () => {
    fireEvent(input, 'blur');
  });
  expect(screen.getAllByRole('button', {name: '읽어 주세요'})).toHaveLength(1);
});

test('‹ 오늘 코스 뒤로 링크: 누름 영역 64 이상(높이·폭), 글자 본문 이상', async () => {
  await toP6();
  const back = screen.getByRole('button', {name: '오늘 코스로 돌아가기'});
  const st = StyleSheet.flatten(typeof back.props.style === 'function' ? back.props.style({pressed: false}) : back.props.style);
  expect(st.minHeight).toBeGreaterThanOrEqual(64);
  expect(st.minWidth).toBeGreaterThanOrEqual(64);
  const text = screen.getByText('‹ 오늘 코스');
  expect(StyleSheet.flatten(text.props.style).fontSize).toBeGreaterThanOrEqual(22);
});
