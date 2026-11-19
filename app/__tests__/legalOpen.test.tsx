// 재확인 3 M5: 약관 줄 링크(P1 ConnectScreen·C0 ChildLogin)는 밖 브라우저가 아니라 앱 안 웹 화면(AU-07 useInAppWeb)으로 연다
import React from 'react';
import {Text} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';

const mockOpen = jest.fn(async (_t: string) => 'opened');
const mockNavigate = jest.fn();
jest.mock('../src/shared/useInAppWeb', () => ({
  useInAppWeb: (nav: (t: string) => void) => ({
    open: (t: string) => {
      nav(t);
      return mockOpen(t);
    },
    busy: null,
  }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate, addListener: () => () => {}}),
}));

test('useLegalOpen: 이용약관·처리방침은 앱 안 웹 화면 Web{target} 으로, 알 수 없는 링크는 무시', async () => {
  const {useLegalOpen, legalLinks} = require('../src/shared/legalLinks');
  const {LegalText} = require('../src/ui/LegalText');
  const Linking = require('react-native').Linking;
  const ext = jest.spyOn(Linking, 'openURL');
  function Probe() {
    const {open: onOpen} = useLegalOpen();
    return (
      <>
        <LegalText testID="legal" text="연결하면 이용약관과 개인정보 처리방침에 동의하게 돼요" links={legalLinks({terms: 'https://t.example', privacy: 'https://p.example'})} onOpen={onOpen} />
        <Text onPress={() => onOpen('https://x.example', '다른 것', 'other')}>다른 링크</Text>
      </>
    );
  }
  render(<Probe />);
  fireEvent.press(screen.getAllByRole('link')[0]);
  expect(mockNavigate).toHaveBeenCalledWith('Web', {target: 'terms'});
  fireEvent(screen.getByTestId('legal'), 'accessibilityAction', {nativeEvent: {actionName: 'link-1'}});
  expect(mockNavigate).toHaveBeenLastCalledWith('Web', {target: 'privacy'});
  fireEvent.press(screen.getByText('다른 링크'));
  expect(mockOpen).toHaveBeenCalledTimes(2);
  expect(ext).not.toHaveBeenCalled(); // 밖 브라우저로 열지 않는다
});

test('재확인 4 M7: 인터넷이 안 닿으면 화면 읽기만이 아니라 Banner 로 보인다', async () => {
  const {act} = require('@testing-library/react-native');
  mockOpen.mockResolvedValueOnce('offline');
  const {useLegalOpen} = require('../src/shared/legalLinks');
  const {Banner} = require('../src/ui/Banner');
  function Probe() {
    const {open, offline} = useLegalOpen();
    return (
      <>
        <Text onPress={() => open('https://t.example', '이용약관', 'terms')}>열기</Text>
        {offline ? <Banner testID="legal-offline" kind="offline" text="인터넷이 연결되면 볼 수 있어요" /> : null}
      </>
    );
  }
  render(<Probe />);
  await act(async () => {
    fireEvent.press(screen.getByText('열기'));
  });
  expect(screen.getByTestId('legal-offline')).toBeTruthy();
});
