// 독립 UX 감사(2026-11-18) 중간·낮음 중 어르신 화면 반영분. 감사 재현 조건(기기 크기·글자 배율)으로 본다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {setStampFeedbackForTest} from '../src/features/course/stampFeedback';
import {enterCode, press, pressCourseNext} from '../testUtils/flow';
import {setWeekStripForTest as setWeekStripForO6} from '../src/features/course/WeekStampStrip';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();
// 오너 결정 O-6(11-20)으로 도장 줄은 기본 꺼짐. 이 파일은 줄이 켜진 때의 동작(컴포넌트는 남김)을 검사하므로 켜고 시작한다
beforeEach(() => setWeekStripForO6(true));
afterEach(() => setWeekStripForO6(null));

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
  expect(screen.queryByTestId('course-week')).toBeNull();
});

test('M1: 찍은 날이 있으면 도장 줄은 그대로', async () => {
  await home({weekDone: [0, 1]});
  await waitFor(() => screen.getByTestId('course-week'));
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

test('P2: 넷째 줄(거절 안내)은 카드 밖 한 줄(v4: 점 머리표, ⓘ 없음)', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고르신 답을 가족과 나눠요'));
  expect(screen.getAllByTestId('consent-point')).toHaveLength(5); // P2 v6 다섯 줄
  expect(screen.getByTestId('consent-decline-note')).toBeTruthy();
});

test('M3: 확인 패널이 열리면 패널 끝까지 보이게 본문을 스크롤한다(하단 고정 돌아가기에 가려지지 않게)', async () => {
  mockDims = {width: 360, height: 640, scale: 3, fontScale: 1.5};
  const {ScrollView} = require('react-native');
  const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
  scrollTo.mockClear();
  await home();
  await press('설정');
  await waitFor(() => screen.getByText('도장 소리'));
  await act(async () => {
    fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}});
  });
  await press('그만 보여 주기');
  const panel = await waitFor(() => screen.getByTestId('settings-confirm'));
  await act(async () => {
    fireEvent(panel, 'layout', {nativeEvent: {layout: {x: 0, y: 500, width: 320, height: 260}}});
  });
  expect(scrollTo).toHaveBeenLastCalledWith({y: 500 + 260 - 300 + 12, animated: true});
});

// #298 QA-3 M1: '다시 보여 주기' 확인 칸은 v6 동의 글이 들어 있어 창보다 클 수 있다. 칸 아래(좋아요)에 맞추면 제목·첫 줄이 화면 위로 밀린 채
// 동의가 기록될 수 있다 → 칸이 창보다 크면 칸 위쪽에 맞춘다(제목·첫 줄부터, 버튼은 스크롤로). 창에 들어가면 지금처럼 칸 끝까지
test('#298 M1: 창보다 큰 확인 칸은 위쪽(제목)에 맞춘다, 창에 들어가면 칸 끝까지', async () => {
  mockDims = {width: 360, height: 640, scale: 3, fontScale: 2};
  const {ScrollView} = require('react-native');
  const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
  scrollTo.mockClear();
  await home({consented: false});
  await press('설정');
  await waitFor(() => screen.getByText('도장 소리'));
  await act(async () => {
    fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}});
  });
  await press('다시 보여 주기');
  const panel = await waitFor(() => screen.getByTestId('settings-confirm'));
  await act(async () => {
    fireEvent(panel, 'layout', {nativeEvent: {layout: {x: 0, y: 500, width: 320, height: 900}}});
  });
  expect(scrollTo).toHaveBeenLastCalledWith({y: 500 - 12, animated: true});
  // 칸이 창에 들어가면(240 ≤ 300) 칸 끝(버튼)까지 보이게 — 이때 위쪽도 함께 보인다
  await act(async () => {
    fireEvent(panel, 'layout', {nativeEvent: {layout: {x: 0, y: 500, width: 320, height: 240}}});
  });
  expect(scrollTo).toHaveBeenLastCalledWith({y: 500 + 240 - 300 + 12, animated: true});
});

// #298 QA-1 L2: 칸이 창과 같거나 간격(12)만큼 모자랄 때(view-12 < 높이 ≤ view) 끝에 맞추면 위쪽이 최대 12 잘린다 → 이 구간도 위쪽에 맞춘다.
// 다만 이 구간의 칸은 이미 다 보일 수 있으므로, 다 보이면 움직이지 않는다
test('#298 L2: 높이가 창과 같거나 창-간격보다 크면 위쪽에 맞추고, 이미 다 보이면 그대로', async () => {
  mockDims = {width: 360, height: 640, scale: 3, fontScale: 2};
  const {ScrollView} = require('react-native');
  const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
  await home({consented: false});
  await press('설정');
  await waitFor(() => screen.getByText('도장 소리'));
  await act(async () => {
    fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}});
  });
  await press('다시 보여 주기');
  const panel = await waitFor(() => screen.getByTestId('settings-confirm'));
  const layout = async (y: number, height: number) => {
    scrollTo.mockClear();
    await act(async () => {
      fireEvent(panel, 'layout', {nativeEvent: {layout: {x: 0, y, width: 320, height}}});
    });
  };
  await layout(500, 300); // 창과 같음
  expect(scrollTo).toHaveBeenLastCalledWith({y: 500 - 12, animated: true});
  await layout(500, 289); // 289 + 12 > 300
  expect(scrollTo).toHaveBeenLastCalledWith({y: 500 - 12, animated: true});
  await layout(500, 288); // 288 + 12 = 300 → 지금처럼 끝(버튼)에 맞춤, 위쪽도 함께 보인다
  expect(scrollTo).toHaveBeenLastCalledWith({y: 500 + 288 - 300 + 12, animated: true});
  await layout(2, 295); // 큰 쪽 구간이지만 창(0~300) 안에 다 보임 → 움직이지 않음
  expect(scrollTo).not.toHaveBeenCalled();
});

// #298 QA-3 L4·L5: 확인 칸은 동의 화면과 같은 제목·거절 안내 키를 쓰고, 글머리표 '•'는 화면 읽기가 읽지 않는다(ConsentScreen 과 같은 방식)
test('#298 L4·L5: 다시 보여 주기 칸 — 동의 제목·다섯 줄·거절 안내, 점은 읽지 않음', async () => {
  const {copy} = require('../src/copy/copy');
  await home({consented: false});
  await press('설정');
  await press('다시 보여 주기');
  const panel = await waitFor(() => screen.getByTestId('settings-confirm'));
  const {within} = require('@testing-library/react-native');
  expect(within(panel).getByText(copy.consent.title)).toBeTruthy();
  expect(within(panel).getByText(copy.consent.decline_note)).toBeTruthy();
  const lines = within(panel).getAllByTestId('resume-consent-point');
  expect(lines.map((l: {props: {accessibilityLabel?: string}}) => l.props.accessibilityLabel)).toEqual(copy.consent.body);
  const dots = within(panel).getAllByTestId('resume-consent-dot', {includeHiddenElements: true});
  expect(dots).toHaveLength(5);
  for (const d of dots) {
    // 점을 감싼 칸이 읽기에서 빠진다(안드로이드 no-hide-descendants, iOS accessibilityElementsHidden)
    let n = d.parent;
    while (n && n.props?.importantForAccessibility !== 'no-hide-descendants') {
      n = n.parent;
    }
    expect(n?.props.accessibilityElementsHidden).toBe(true);
  }
});
