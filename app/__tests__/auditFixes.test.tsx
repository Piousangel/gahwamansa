// 독립 UX 감사(2026-11-18) 중간·낮음 중 어르신 화면 반영분. 감사 재현 조건(기기 크기·글자 배율)으로 본다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {enterCode, press, pressCourseNext} from '../testUtils/flow';

let mockDims = {width: 411, height: 914, scale: 3, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));
beforeEach(() => {
  setLocalStampsForTest(createLocalStamps(memoryStore()));
  setPrefsForTest(createPrefs(memoryStore()));
  setStampFeedbackForTest(() => ({fire: async () => ({sound: false, haptic: false})}));
});
afterEach(() => {
  setLocalStampsForTest(null);
  setPrefsForTest(null);
  setStampFeedbackForTest(null);
  mockDims = {width: 411, height: 914, scale: 3, fontScale: 1};
});

async function home(opts: FakeOptions = {}) {
  render(<AppRoot api={createFakeApi({linked: true, consented: true, ...opts})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
}

test('M1(411×914 100%): 이번 주 도장이 0이면 도장 줄을 숨긴다(첫 진입 해님 인사와 겹침 해소)', async () => {
  await home({weekDone: []});
  await waitFor(() => screen.getByTestId('course-steps'));
  expect(screen.queryByTestId('stamp-day-0')).toBeNull();
});

test('M1: 찍은 날이 있으면 도장 줄은 그대로', async () => {
  await home({weekDone: [0, 1]});
  await waitFor(() => screen.getByTestId('stamp-day-0'));
});

test('L1: 3/3 인사는 마침표 뒤 줄바꿈', async () => {
  await home({completedSteps: ['photo', 'question', 'hangul']});
  expect(screen.getByText('오늘 코스는 여기까지예요.\n내일 또 만나요')).toBeTruthy();
});

test('L4: P6 에는 오늘 코스로(U13) 링크가 없다(글자 100%에서도)', async () => {
  await home({completedSteps: ['photo', 'question']});
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  expect(screen.queryByTestId('to-course-home')).toBeNull();
});

test('M9(150%): P7 제목은 첫 프레임부터 보인다(연출은 둘째 줄만)', async () => {
  mockDims = {width: 411, height: 914, scale: 3, fontScale: 1.5};
  await home({completedSteps: ['photo', 'question']});
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await press('오늘은 넘어갈게요');
  const title = await waitFor(() => screen.getByTestId('p7-title'));
  // 제목은 투명도 애니메이션 묶음 밖(첫 프레임부터 불투명)
  type Node = {parent: Node | null; props?: {testID?: string}};
  const ids: (string | undefined)[] = [];
  for (let n = title as unknown as Node | null; n; n = n.parent) {
    ids.push(n.props?.testID);
  }
  expect(ids).not.toContain('p7-text');
  expect(screen.getByRole('button', {name: '알겠어요'})).toBeTruthy();
});

test('M3(360 폭 100%): 답 보여 주기 행은 동사 버튼을 다음 줄 전체 폭으로 쌓는다', async () => {
  mockDims = {width: 360, height: 640, scale: 3, fontScale: 1};
  await home();
  await press('설정');
  const row = await waitFor(() => screen.getByTestId('settings-row-share'));
  expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
});

test('P2: 넷째 줄은 체크 카드 밖 ⓘ 한 줄', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  expect(screen.getAllByTestId('consent-point')).toHaveLength(3);
  expect(screen.getByTestId('consent-info')).toBeTruthy();
});
