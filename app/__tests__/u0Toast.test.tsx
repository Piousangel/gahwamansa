import React from 'react';
import {AccessibilityInfo, Pressable, StyleSheet, Text} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {ToastProvider, useToast, TOAST_MS} from '../src/ui/Toast';

beforeEach(() => {
  jest.clearAllMocks(); // 프리셋의 AccessibilityInfo 는 jest.fn 이라 spyOn 이 같은 함수를 돌려줘 호출 수가 쌓인다
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function Harness({retry}: {retry?: () => void}) {
  const toast = useToast();
  return (
    <>
      <Pressable testID="ok" onPress={() => toast.show({text: '응원을 보냈어요'})}>
        <Text>ok</Text>
      </Pressable>
      <Pressable testID="ok2" onPress={() => toast.show({text: '복사했어요'})}>
        <Text>ok2</Text>
      </Pressable>
      <Pressable testID="err" onPress={() => toast.show({kind: 'error', text: '보내지 못했어요', action: {label: '다시 하기', onPress: retry ?? (() => {})}})}>
        <Text>err</Text>
      </Pressable>
    </>
  );
}

const ui = (retry?: () => void) => (
  <ToastProvider>
    <Harness retry={retry} />
  </ToastProvider>
);

describe('Toast(자녀 토스트)', () => {
  test('6초(최소 5초) 보인 뒤 사라진다', () => {
    render(ui());
    fireEvent.press(screen.getByTestId('ok'));
    expect(TOAST_MS).toBeGreaterThanOrEqual(5000);
    act(() => jest.advanceTimersByTime(TOAST_MS - 100));
    expect(screen.getByText('응원을 보냈어요')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByText('응원을 보냈어요')).toBeNull();
  });

  test('한 번에 1개만: 새 토스트가 이전 것을 바꾼다', () => {
    render(ui());
    fireEvent.press(screen.getByTestId('ok'));
    fireEvent.press(screen.getByTestId('ok2'));
    expect(screen.queryByText('응원을 보냈어요')).toBeNull();
    expect(screen.getByText('복사했어요')).toBeTruthy();
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });

  test('오류 토스트는 자동으로 사라지지 않고 다시 하기를 누르면 닫히며 호출', () => {
    const retry = jest.fn();
    render(ui(retry));
    fireEvent.press(screen.getByTestId('err'));
    act(() => jest.advanceTimersByTime(60_000));
    const btn = screen.getByRole('button', {name: '다시 하기'});
    expect(StyleSheet.flatten(btn.props.style).minHeight).toBeGreaterThanOrEqual(56);
    fireEvent.press(btn);
    expect(retry).toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByText('보내지 못했어요')).toBeNull();
  });

  test('글자 20 굵게(자녀도 최소 20), R11: 나타날 때 한 번만 읽음(오류도 polite, 알림 경로 하나)', () => {
    render(ui());
    fireEvent.press(screen.getByTestId('ok'));
    const t = StyleSheet.flatten(screen.getByText('응원을 보냈어요').props.style);
    expect(t.fontSize).toBe(20);
    expect(t.fontWeight).toBe('bold');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('응원을 보냈어요');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('toast').props.accessibilityLiveRegion ?? 'none').toBe('none');
    fireEvent.press(screen.getByTestId('err'));
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('toast').props.accessibilityLiveRegion ?? 'none').toBe('none');
  });

  test('Provider 없이 useToast 를 쓰면 바로 알려 준다', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/ToastProvider/);
    err.mockRestore();
  });
});
