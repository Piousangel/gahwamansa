// talkback-spec R2: 화면에 들어오면 첫 포커스는 화면 제목(공통 Screen)
import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {act, render, screen} from '@testing-library/react-native';
import {Screen} from '../src/ui/Screen';
import {Text20} from '../src/ui/Text20';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('a11y R2: 화면에 들어오면 300ms 뒤 제목(header)에 접근성 포커스(공통 Screen)', () => {
  jest.useFakeTimers();
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  render(
    <Screen top={<Text20 accessibilityRole="header">제목</Text20>}>
      <Text20 accessibilityRole="header">본문 머리글</Text20>
    </Screen>,
  );
  expect(focus).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(300);
  });
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus.mock.calls[0][1]).toBe('focus');
  // 위 고정 영역의 첫 머리글("제목")이 대상(본문 머리글이 아님)
  expect((focus.mock.calls[0][0] as unknown as {props: {children: unknown}}).props.children).toBe('제목');
  screen.unmount();
});

