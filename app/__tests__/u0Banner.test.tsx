import React from 'react';
import {AccessibilityInfo, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {Banner, BANNER_SUCCESS_MS} from '../src/ui/Banner';

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

describe('Banner(어르신 배너)', () => {
  test('오류 배너: 글자 22 굵게, 높이 64 이상, 다시 하기 64 터치, 자동으로 사라지지 않음', () => {
    const retry = jest.fn();
    render(<Banner kind="error" text="저장하지 못했어요. 다시 해 볼까요?" action={{label: '다시 하기', onPress: retry}} />);
    const t = StyleSheet.flatten(screen.getByText('저장하지 못했어요. 다시 해 볼까요?').props.style);
    expect(t.fontSize).toBe(22);
    expect(t.fontWeight).toBe('bold');
    expect(StyleSheet.flatten(screen.getByTestId('banner').props.style).minHeight).toBeGreaterThanOrEqual(64);
    const btn = screen.getByRole('button', {name: '다시 하기'});
    const bs = StyleSheet.flatten(btn.props.style);
    expect(bs.minHeight).toBeGreaterThanOrEqual(64);
    expect(bs.minWidth).toBeGreaterThanOrEqual(64);
    fireEvent.press(btn);
    expect(retry).toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText('저장하지 못했어요. 다시 해 볼까요?')).toBeTruthy();
  });

  test('R11: 나타날 때·바뀔 때 한 번만 읽고(오류도 assertive 아님), 다시 그려도 반복하지 않는다', () => {
    render(<Banner kind="error" text="저장하지 못했어요" />);
    expect(screen.getByTestId('banner').props.accessibilityLiveRegion).not.toBe('assertive');
    // 알림 경로는 하나만(liveRegion 과 announce 를 같이 쓰면 두 번 읽힘)
    expect(screen.getByTestId('banner').props.accessibilityLiveRegion ?? 'none').toBe('none');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('저장하지 못했어요');
    screen.rerender(<Banner kind="error" text="저장하지 못했어요" />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    screen.rerender(<Banner kind="offline" text="인터넷이 잠깐 끊겼어요" />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2);
  });

  test('R5: 아이콘은 장식(글자 옆)이라 읽지 않는다', () => {
    render(<Banner kind="error" text="저장하지 못했어요" />);
    expect(screen.queryByTestId('icon-warning')).toBeNull(); // 숨김 요소는 기본 조회에서 빠짐
    expect(screen.getByTestId('icon-warning', {includeHiddenElements: true})).toBeTruthy();
  });

  test('색만으로 구분하지 않는다: 종류마다 아이콘이 있다', () => {
    const icons: Record<string, string> = {error: 'icon-warning', offline: 'icon-wifi-off', success: 'icon-check', info: 'icon-info'};
    for (const [kind, icon] of Object.entries(icons)) {
      const {unmount} = render(<Banner kind={kind as 'error'} text="알림" />);
      expect(screen.getByTestId(icon, {includeHiddenElements: true})).toBeTruthy();
      unmount();
    }
  });

  test('성공 배너는 6초 이상 머문 뒤 사라지고 onHidden 을 부른다', () => {
    const onHidden = jest.fn();
    render(<Banner kind="success" text="연결됐어요! 이제 함께해요" onHidden={onHidden} />);
    expect(BANNER_SUCCESS_MS).toBeGreaterThanOrEqual(6000);
    act(() => jest.advanceTimersByTime(BANNER_SUCCESS_MS - 100));
    expect(screen.getByText('연결됐어요! 이제 함께해요')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByText('연결됐어요! 이제 함께해요')).toBeNull();
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  test('오프라인 → 같은 자리에서 성공으로 바뀌면 그때부터 6초 뒤 사라짐', () => {
    render(<Banner kind="offline" text="인터넷이 잠깐 끊겼어요" />);
    act(() => jest.advanceTimersByTime(20_000));
    screen.rerender(<Banner kind="success" text="다시 연결됐어요" />);
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.getByText('다시 연결됐어요')).toBeTruthy();
    act(() => jest.advanceTimersByTime(BANNER_SUCCESS_MS));
    expect(screen.queryByText('다시 연결됐어요')).toBeNull();
  });
});
