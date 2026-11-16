import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {BigButton} from '../src/ui/BigButton';
import {Text20} from '../src/ui/Text20';
import {SelectCard} from '../src/ui/SelectCard';
import {AssetPlaceholder} from '../src/ui/assets/AssetPlaceholder';

test('BigButton은 높이 64 이상, 글자 20 이상', () => {
  render(<BigButton label="다음" onPress={() => {}} />);
  const btn = screen.getByRole('button', {name: '다음'});
  const s = StyleSheet.flatten(btn.props.style);
  expect(s.minHeight).toBeGreaterThanOrEqual(64);
  const t = StyleSheet.flatten(screen.getByText('다음').props.style);
  expect(t.fontSize).toBeGreaterThanOrEqual(20);
});
test('BigButton 비활성이면 누르기가 무시된다', () => {
  const fn = jest.fn();
  render(<BigButton label="다음" disabled onPress={fn} />);
  fireEvent.press(screen.getByText('다음'));
  expect(fn).not.toHaveBeenCalled();
});
test('Text20은 작은 글자 크기를 요청해도 20 이상', () => {
  render(<Text20 size={12}>안녕</Text20>);
  const s = StyleSheet.flatten(screen.getByText('안녕').props.style);
  expect(s.fontSize).toBeGreaterThanOrEqual(20);
});
test('SelectCard는 선택 상태를 글자로도 알린다', () => {
  const fn = jest.fn();
  render(<SelectCard label="봄" selected onPress={fn} />);
  expect(screen.getByText('골랐어요')).toBeTruthy();
  fireEvent.press(screen.getByText('봄'));
  expect(fn).toHaveBeenCalled();
});
test('AssetPlaceholder는 [아이콘: 이름] 라벨을 보여 준다', () => {
  render(<AssetPlaceholder name="sun-happy" />);
  expect(screen.getByText('[아이콘: sun-happy]')).toBeTruthy();
});
