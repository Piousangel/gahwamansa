import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {kstDateLine, weekStamps} from '../src/features/course/stamps';
import {press} from '../testUtils/flow';

test('날짜 줄: KST 기준 "11월 20일 금요일"', () => {
  expect(kstDateLine(new Date('2026-11-20T01:00:00Z'))).toBe('11월 20일 금요일');
  expect(kstDateLine(new Date('2026-11-19T16:00:00Z'))).toBe('11월 20일 금요일'); // KST 자정 넘김
});

test('이번 주 도장: 오늘 끝냈으면 오늘까지, 아니면 어제까지 연속일만큼(월=0)', () => {
  expect(weekStamps(4, 2, true)).toEqual([false, false, false, true, true, false, false]);
  expect(weekStamps(4, 2, false)).toEqual([false, false, true, true, false, false, false]);
  expect(weekStamps(1, 5, true)).toEqual([true, true, false, false, false, false, false]); // 지난주로 넘어가는 건 자름
  expect(weekStamps(3, 0, false)).toEqual([false, false, false, false, false, false, false]);
});

async function previewHome() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
}

test('미연결 안내는 얇은 띠 한 줄 + 작은 링크(터치 48 이상), 큰 버튼은 아래 하나뿐', async () => {
  await previewHome();
  const link = screen.getByRole('button', {name: '번호 쓰기'});
  expect(StyleSheet.flatten(link.props.style).minHeight).toBeGreaterThanOrEqual(48);
  expect(screen.getAllByTestId('big-button')).toHaveLength(1); // 지금 할 단계로 가는 주 버튼
});

test('"오늘의 코스" 아래 "오늘 코스예요" 중복 없음, 날짜 줄·도장 줄·스티치', async () => {
  await previewHome();
  expect(screen.queryByText('오늘 코스예요')).toBeNull();
  expect(screen.getByTestId('date-line')).toBeTruthy();
  expect(screen.getByText('이번 주 도장')).toBeTruthy();
  expect(screen.getAllByTestId(/^stamp-day-/)).toHaveLength(7);
  expect(screen.getByTestId('stitch', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByText(/연속/)).toBeNull();
});

test('진행 문구: 1/3 이면 "둘 남았어요"', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo']})} role="parent" restore />);
  await waitFor(() => screen.getByText('둘 남았어요'));
});

test('도장: 연속일만큼 이번 주 칸에 붙는다(숫자 표시 없음)', async () => {
  render(
    <AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul'], streak: 2})} role="parent" restore />,
  );
  await waitFor(() => screen.getByText('이번 주 도장'));
  expect(screen.getAllByTestId(/^stamp-on-/, {includeHiddenElements: true})).toHaveLength(2);
});
