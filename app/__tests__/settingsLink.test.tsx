// 오너 S25 P-3(11-24): 설정 들어가기는 어르신·자녀 같은 컴포넌트(ds SettingsLink) — 톱니 아이콘 + 밑줄 파랑 글자(R-08), 크기는 audience
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, within} from '@testing-library/react-native';
import {AudienceProvider, SettingsLink} from '../src/ui/ds';
import {TopBar} from '../src/ui/TopBar';

const look = (testID: string) => {
  const btn = screen.getByTestId(testID);
  const icon = within(btn).getByTestId('icon-settings', {includeHiddenElements: true});
  const label = within(btn).getByText('설정');
  return {icon: icon.props.width as number, text: StyleSheet.flatten(label.props.style)};
};

test('어르신: 톱니 24 + 밑줄 글자, 읽기 이름은 글자 그대로', () => {
  render(<SettingsLink label="설정" onPress={() => {}} testID="s" />);
  const l = look('s');
  expect(l.icon).toBe(24);
  expect(l.text.textDecorationLine).toBe('underline');
  expect(screen.getByRole('button', {name: '설정'})).toBeTruthy();
});

test('자녀 상단 바(TopBar)도 같은 SettingsLink: 톱니 20 + 밑줄 글자(아이콘이 글자보다 크지 않게)', () => {
  render(
    <AudienceProvider value="child">
      <TopBar title="홈" settingsLabel="설정" onSettings={() => {}} />
    </AudienceProvider>,
  );
  const l = look('topbar-settings');
  expect(l.icon).toBe(20);
  expect(l.text.textDecorationLine).toBe('underline');
  expect(l.icon).toBeLessThanOrEqual((l.text.fontSize as number) * 1.25);
});
