import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render, screen, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {RoleChoiceButton, roleChoiceStyle} from '../src/features/link/RoleChoiceButton';
import {color} from '../src/ui/tokens';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

const style = (el: {props: Record<string, any>}, pressed = false): Record<string, any> => {
  const st = el.props.style;
  return StyleSheet.flatten(typeof st === 'function' ? st({pressed}) : st) ?? {};
};

test('D2-C: 부모님=노랑 면, 자녀=하늘 면, 갈색 테두리 3 + 아래 두께 7, 반경 24, 높이 88 이상, 오른쪽 ›', () => {
  render(<AppRoot api={createFakeApi()} />);
  const parent = screen.getByRole('button', {name: '부모님 휴대폰이에요. 가족에게 받은 번호를 써요'});
  const child = screen.getByRole('button', {name: '자녀 휴대폰이에요. 부모님께 보낼 번호를 만들어요'});
  for (const [b, bg] of [
    [parent, color.accentSun],
    [child, color.sky],
  ] as const) {
    const s = style(b);
    expect(s.backgroundColor).toBe(bg);
    expect(s.borderWidth).toBe(3);
    expect(s.borderBottomWidth).toBe(7);
    expect(s.borderColor).toBe(color.ink);
    expect(s.borderRadius).toBe(24);
    expect(s.minHeight).toBeGreaterThanOrEqual(88);
    expect(within(b).getByTestId('icon-chevron-right', {includeHiddenElements: true})).toBeTruthy();
  }
});

test('눌림: 두께 3, 4 내려감, 면 actionSoft. 손을 떼면 바로 이동(다음 단계 없음)', () => {
  const s: Record<string, unknown> = StyleSheet.flatten(roleChoiceStyle('parent', true)) ?? {};
  expect(s.borderBottomWidth).toBe(3);
  expect(s.transform).toEqual([{translateY: 4}]);
  expect(s.backgroundColor).toBe(color.actionSoft);
  expect((StyleSheet.flatten(roleChoiceStyle('parent', false)) as Record<string, unknown>).borderBottomWidth).toBe(7);
  const onPress = jest.fn();
  render(<RoleChoiceButton tone="parent" title="부모님 휴대폰이에요" sub="가족에게 받은 번호를 써요" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('제목 26 상한·굵게·inkTitle, 둘째 줄 20 inkBody(읽는 글, 디자인 시스템 패널 r1)', () => {
  render(<RoleChoiceButton tone="child" title="자녀 휴대폰이에요" sub="부모님께 보낼 번호를 만들어요" onPress={() => {}} />);
  const t = StyleSheet.flatten(screen.getByText('자녀 휴대폰이에요').props.style);
  expect(t.fontSize).toBe(26);
  expect(t.color).toBe(color.inkTitle);
  const sub = StyleSheet.flatten(screen.getByText('부모님께 보낼 번호를 만들어요').props.style);
  expect(sub.fontSize).toBe(20);
  expect(sub.color).toBe(color.inkBody);
});
