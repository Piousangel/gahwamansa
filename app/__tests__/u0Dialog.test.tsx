import React from 'react';
import {AccessibilityInfo, Modal, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {Dialog} from '../src/ui/Dialog';
import {FONT_SCALE_MAX, FONT_SCALE_MAX_BODY} from '../src/ui/tokens';

const actions = (stay = jest.fn(), leave = jest.fn()) => [
  {label: '계속 할게요', onPress: stay},
  {label: '나중에 할게요', onPress: leave, kind: 'secondary' as const},
];

describe('Dialog(어르신 대화상자)', () => {
  test('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(<Dialog visible={false} title="오늘은 여기까지 할까요?" actions={actions()} />);
    expect(screen.queryByText('오늘은 여기까지 할까요?')).toBeNull();
  });

  test('제목·본문·버튼을 보여 주고, 제목 1.5·본문 2.0 배율 상한', () => {
    render(<Dialog visible title="오늘은 여기까지 할까요?" body="지금까지 한 것은 저장돼 있어요" actions={actions()} />);
    const title = screen.getByText('오늘은 여기까지 할까요?');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(32);
    expect(title.props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX);
    const body = screen.getByText('지금까지 한 것은 저장돼 있어요');
    expect(StyleSheet.flatten(body.props.style).fontSize).toBe(22);
    expect(body.props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX_BODY);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('alertdialog 역할 + 뒤 화면 읽기 막음(포커스 가둠)', () => {
    render(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions()} />);
    const card = screen.getByTestId('dialog-card');
    expect(card.props.role).toBe('alertdialog');
    expect(card.props.accessibilityViewIsModal).toBe(true);
  });

  test('열리면 화면 읽기 포커스가 제목으로 간다', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    render(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions()} />);
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onShow?.();
    });
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'focus');
    spy.mockRestore();
  });

  test('밖(어두운 배경)을 눌러도 닫히지 않고, 닫기 X도 없다', () => {
    const stay = jest.fn();
    const leave = jest.fn();
    render(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions(stay, leave)} />);
    const scrim = screen.getByTestId('dialog-scrim');
    expect(scrim.props.onPress).toBeUndefined();
    expect(screen.queryByLabelText('닫기')).toBeNull();
    expect(stay).not.toHaveBeenCalled();
  });

  test('안드로이드 뒤로 = 맨 위(안전한) 선택지, onBack 을 주면 그것', () => {
    const stay = jest.fn();
    render(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions(stay)} />);
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(stay).toHaveBeenCalledTimes(1);

    const back = jest.fn();
    screen.rerender(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions(stay)} onBack={back} />);
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(back).toHaveBeenCalledTimes(1);
    expect(stay).toHaveBeenCalledTimes(1);
  });

  test('위험 대화상자: 주 버튼 "그만둘래요"가 위, "지우기"는 위험 외곽선', () => {
    const del = jest.fn();
    render(
      <Dialog
        visible
        tone="danger"
        title="내 기록을 지울까요?"
        body="지우면 되돌릴 수 없어요"
        actions={[
          {label: '그만둘래요', onPress: () => {}},
          {label: '지우기', onPress: del, kind: 'danger'},
        ]}
      />,
    );
    const [first, second] = screen.getAllByRole('button');
    expect(first.props.accessibilityLabel).toBe('그만둘래요');
    expect(second.props.accessibilityLabel).toBe('지우기');
    expect(StyleSheet.flatten(second.props.style).borderWidth).toBeGreaterThan(0);
    fireEvent.press(second);
    expect(del).toHaveBeenCalled();
    expect(screen.getByText('조심하세요')).toBeTruthy(); // 색만으로 구분하지 않음: 글자 칩
  });

  test('버튼 터치 높이 64 이상, 사이 간격 12 이상(BigButton 위아래 6+6)', () => {
    render(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions()} />);
    for (const b of screen.getAllByRole('button')) {
      expect(StyleSheet.flatten(b.props.style).minHeight).toBeGreaterThanOrEqual(64);
    }
    const wraps = screen.getAllByTestId('big-button');
    const gap = wraps.map(w => StyleSheet.flatten(w.props.style).marginVertical ?? 0).reduce((a, b) => a + b, 0);
    expect(gap).toBeGreaterThanOrEqual(12);
  });

  test('열고 닫을 때 위치 이동 없이 불투명도만 쓴다', () => {
    render(<Dialog visible title="오늘은 여기까지 할까요?" actions={actions()} />);
    const fade = StyleSheet.flatten(screen.getByTestId('dialog-scrim').props.style);
    expect(fade.transform).toBeUndefined();
    expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
  });
});
