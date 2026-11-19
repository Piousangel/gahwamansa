import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {kstDateLine, stampsFromDates} from '../src/features/course/stamps';
import {press, pressCourseNext} from '../testUtils/flow';

test('날짜 줄: KST 기준 "11월 20일 금요일"', () => {
  expect(kstDateLine(new Date('2026-11-20T01:00:00Z'))).toBe('11월 20일 금요일');
  expect(kstDateLine(new Date('2026-11-19T16:00:00Z'))).toBe('11월 20일 금요일'); // KST 자정 넘김
});

test('이번 주 도장: 서버가 준 완료 날짜(띄엄띄엄도)를 월~일 칸에 칠한다', () => {
  expect(stampsFromDates('2026-11-16', ['2026-11-16', '2026-11-18', '2026-11-20'])).toEqual([true, false, true, false, true, false, false]);
  expect(stampsFromDates('2026-11-16', [])).toEqual([false, false, false, false, false, false, false]);
  expect(stampsFromDates('2026-11-16', ['2026-11-15', '2026-11-23'])).toEqual([false, false, false, false, false, false, false]); // 이번 주 밖은 무시
});

async function previewHome() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
}

test('미연결 안내는 띠 전체가 하나의 버튼(터치 48 이상, 어르신 기준 64), 큰 버튼은 아래 하나뿐', async () => {
  await previewHome();
  const strip = screen.getByTestId('course-strip');
  expect(strip.props.accessibilityRole).toBe('button');
  expect(StyleSheet.flatten(strip.props.style).minHeight).toBeGreaterThanOrEqual(64);
  expect(within(screen.getByTestId('screen-dock')).getAllByRole('button')).toHaveLength(1); // 지금 할 단계로 가는 주 버튼
});

test('미연결: 날짜 줄·스티치, 미연결이면 도장 줄 숨김(서버 호출 없음)', async () => {
  const api = createFakeApi();
  const week = jest.spyOn(api, 'getWeekStamps');
  render(<AppRoot api={api} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
  expect(screen.queryByText('세 가지를 차례로 해요')).toBeNull(); // v4: 인사는 연결된 첫날 카드 1개뿐(미연결 열람엔 없음)
  expect(screen.getByTestId('date-line')).toBeTruthy();
  await new Promise<void>(r => setTimeout(() => r(), 30));
  expect(screen.queryByTestId('course-week')).toBeNull(); // 기기 로컬 도장 0 → 줄 숨김(감사 M1·디자인 판정)
  expect(week).not.toHaveBeenCalled();
  expect(screen.getAllByTestId('stitch', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText(/연속/)).toBeNull();
});

test('1/3: 진행 문구 없음(시안 ds4b 1/3 보드). 첫날 인사가 보이는 동안 다음 행은 이름만(0/3 보드)', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo']})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('step-wait-hangul'));
  expect(screen.queryByText('둘 남았어요')).toBeNull();
  expect(screen.getByTestId('step-wait-hangul').props.accessibilityLabel).toBe(screen.queryByTestId('first-greeting') ? '자판으로 쓰기' : '자판으로 쓰기, 다음 차례');
});

test('도장: 서버의 이번 주 완료 날짜만큼 붙는다(띄엄띄엄, 숫자 없음)', async () => {
  const api = createFakeApi({linked: true, consented: true, weekDone: [0, 2]}); // 월·수
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('course-week'));
  await waitFor(() => expect(screen.getAllByTestId(/^stamp-on-/, {includeHiddenElements: true})).toHaveLength(2));
  expect(screen.getByTestId('stamp-on-0', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getByTestId('stamp-on-2', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.getAllByTestId(/^stamp-(on|empty)-/, {includeHiddenElements: true})).toHaveLength(7);
});

test('오늘 코스를 마치면 도장 줄을 다시 불러온다', async () => {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question'], weekDone: [0]}); // 찍은 날이 있어야 줄이 보인다(감사 M1)
  const week = jest.spyOn(api, 'getWeekStamps');
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('course-week'));
  const n = week.mock.calls.length;
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 썼어요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await waitFor(() => expect(week.mock.calls.length).toBeGreaterThan(n));
});
