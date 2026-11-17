import React from 'react';
import {AccessibilityInfo, Modal, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {BottomSheet} from '../src/ui/BottomSheet';
import {FONT_SCALE_MAX} from '../src/ui/tokens';

const base = {
  title: '곧 유료 서비스예요',
  body: '사전 신청만 받고 결제는 하지 않아요',
};

describe('BottomSheet(자녀 아래 시트)', () => {
  test('닫혀 있으면 그리지 않는다', () => {
    render(<BottomSheet closeLabel="닫기" visible={false} {...base} onClose={() => {}} />);
    expect(screen.queryByText(base.title)).toBeNull();
  });

  test('닫는 길 4가지: X·보조 버튼·밖 누르기·안드로이드 뒤로', () => {
    const onClose = jest.fn();
    const later = jest.fn();
    render(
      <BottomSheet closeLabel="닫기" visible {...base} onClose={onClose} primary={{label: '사전 신청하기', onPress: () => {}}} secondary={{label: '다음에 볼게요', onPress: later}} />,
    );
    fireEvent.press(screen.getByRole('button', {name: '닫기'}));
    fireEvent.press(screen.getByTestId('sheet-scrim', {includeHiddenElements: true}));
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.press(screen.getByRole('button', {name: '다음에 볼게요'}));
    expect(later).toHaveBeenCalled();
  });

  test('닫기·버튼 터치 56 이상, 제목·버튼 글자 배율 1.5', () => {
    render(<BottomSheet closeLabel="닫기" visible {...base} onClose={() => {}} primary={{label: '사전 신청하기', onPress: () => {}}} />);
    for (const b of screen.getAllByRole('button')) {
      const s = StyleSheet.flatten(b.props.style);
      expect(s.minHeight).toBeGreaterThanOrEqual(56);
    }
    const close = StyleSheet.flatten(screen.getByRole('button', {name: '닫기'}).props.style);
    expect(close.minWidth).toBeGreaterThanOrEqual(56);
    expect(screen.getByText(base.title).props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX);
    expect(screen.getByText('사전 신청하기').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX);
  });

  test('글자 최소 20(자녀도 같은 기준, impl-drift #5): 제목 24, 본문·버튼·이유 20', () => {
    render(
      <BottomSheet closeLabel="닫기" visible {...base} onClose={() => {}} primary={{label: '사전 신청하기', onPress: () => {}, disabled: true, disabledReason: '이메일을 먼저 써 주세요'}} />,
    );
    expect(StyleSheet.flatten(screen.getByText(base.title).props.style).fontSize).toBe(24);
    expect(StyleSheet.flatten(screen.getByText(base.body).props.style).fontSize).toBe(20);
    expect(StyleSheet.flatten(screen.getByText('사전 신청하기').props.style).fontSize).toBeGreaterThanOrEqual(20);
    expect(StyleSheet.flatten(screen.getByText('이메일을 먼저 써 주세요', {includeHiddenElements: true}).props.style).fontSize).toBeGreaterThanOrEqual(20);
  });

  test('모달이라 뒤 화면을 읽지 않고, 열리면 포커스가 제목으로', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    render(<BottomSheet closeLabel="닫기" visible {...base} onClose={() => {}} />);
    expect(screen.getByTestId('sheet-panel').props.accessibilityViewIsModal).toBe(true);
    act(() => screen.UNSAFE_getByType(Modal).props.onShow?.());
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'focus');
    spy.mockRestore();
  });

  test('R12: 닫히면 연 버튼으로 포커스가 돌아간다(300ms 뒤)', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    const opener = {current: {tag: 'opener'}};
    render(<BottomSheet closeLabel="닫기" visible {...base} onClose={() => {}} returnFocusRef={opener} />);
    spy.mockClear();
    screen.rerender(<BottomSheet closeLabel="닫기" visible={false} {...base} onClose={() => {}} returnFocusRef={opener} />);
    act(() => jest.advanceTimersByTime(300));
    expect(spy).toHaveBeenCalledWith(opener.current, 'focus');
    spy.mockRestore();
    jest.useRealTimers();
  });

  test('R8: 비활성 버튼은 이유를 힌트로 읽는다', () => {
    render(<BottomSheet closeLabel="닫기" visible {...base} onClose={() => {}} primary={{label: '사전 신청하기', onPress: () => {}, disabled: true, disabledReason: '이메일을 먼저 써 주세요'}} />);
    const b = screen.getByRole('button', {name: '사전 신청하기'});
    expect(b.props.accessibilityState).toEqual(expect.objectContaining({disabled: true}));
    expect(b.props.accessibilityHint).toBe('이메일을 먼저 써 주세요');
  });

  test('R5: 핸들은 장식이라 읽지 않는다', () => {
    render(<BottomSheet closeLabel="닫기" visible {...base} onClose={() => {}} />);
    expect(screen.getByTestId('sheet-handle', {includeHiddenElements: true}).props.importantForAccessibility).toBe('no');
  });
});
