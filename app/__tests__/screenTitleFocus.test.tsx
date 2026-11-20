// talkback-spec R2: 화면에 들어오면 첫 포커스는 화면 제목(공통 Screen)
import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {Screen} from '../src/ui/Screen';
import {Text20} from '../src/ui/Text20';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press, pressCourseNext} from '../testUtils/flow';

const reader = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(on);
const target = (call: unknown[]) => call[0] as {props: {children?: unknown; testID?: string}};

// RN jest 프리셋의 AccessibilityInfo 함수는 모듈 목(jest.fn)이라 spyOn 이 같은 목을 돌려준다 → 호출 기록을 테스트마다 비운다
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('a11y R2: 화면에 들어오면 300ms 뒤 제목(header)에 접근성 포커스(공통 Screen)', async () => {
  jest.useFakeTimers();
  reader(true);
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  render(
    <Screen top={<Text20 accessibilityRole="header">제목</Text20>}>
      <Text20 accessibilityRole="header">본문 머리글</Text20>
    </Screen>,
  );
  expect(focus).not.toHaveBeenCalled();
  await act(async () => {}); // 화면 읽기 상태 확인(비동기)을 먼저 끝낸다
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus.mock.calls[0][1]).toBe('focus');
  // 위 고정 영역의 첫 머리글("제목")이 대상(본문 머리글이 아님)
  expect((focus.mock.calls[0][0] as unknown as {props: {children: unknown}}).props.children).toBe('제목');
  screen.unmount();
});


test('화면 읽기가 꺼져 있으면 포커스 타이머·호출이 없다', async () => {
  jest.useFakeTimers();
  reader(false);
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  render(
    <Screen>
      <Text20 accessibilityRole="header">제목</Text20>
    </Screen>,
  );
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(focus).not.toHaveBeenCalled();
});

test('같은 Screen 에서 제목이 바뀌면(로딩 → 본 화면) 언마운트된 옛 제목이 아니라 지금 제목에 포커스', async () => {
  jest.useFakeTimers();
  reader(true);
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const ui = (loading: boolean) => (
    <Screen top={loading ? <Text20 accessibilityRole="header">불러오는 중 제목</Text20> : <Text20 accessibilityRole="header">진짜 제목</Text20>}>
      <Text20>본문</Text20>
    </Screen>
  );
  const {rerender} = render(ui(true));
  rerender(ui(false));
  await act(async () => {}); // 화면 읽기 상태 확인(비동기)을 먼저 끝낸다
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(focus).toHaveBeenCalledTimes(1);
  expect(target(focus.mock.calls[0]).props.children).toBe('진짜 제목');
});

test('단계 화면(P4)은 단계 제목 줄(step-header)에 포커스', async () => {
  reader(true);
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await press('코스 보기');
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('step-header'));
  await waitFor(() => expect(focus.mock.calls.some(c => target(c).props.testID === 'step-header')).toBe(true));
});
