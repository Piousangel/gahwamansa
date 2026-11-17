// production 환경(실행 중 2차 방어, 보안 리뷰 L1·L4): 메뉴 구현이 번들에 있더라도 열리지 않고, 버전 줄은 누를 수 없는 글자
import React, {useContext} from 'react';
import {Text} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';

jest.mock('../src/lib/env', () => {
  const actual = jest.requireActual('../src/lib/env');
  const env = {...actual.DEFAULT_ENV, APP_ENV: 'production', API_MODE: 'real'};
  return {...actual, getAppEnv: () => env};
});

import {DevMenuHost} from '../src/dev/DevMenuHost';
import {DevMenuContext, useAppVersionTaps} from '../src/dev/devGate';
import {createFakeApi} from '../src/features/fakeApi';

function Opener() {
  const {open} = useContext(DevMenuContext);
  const tap = useAppVersionTaps();
  return (
    <>
      <Text onPress={open}>열기</Text>
      <Text testID="tap-state">{tap ? 'pressable' : 'plain'}</Text>
    </>
  );
}

test('production 이면 DevMenuHost 구현도 open 을 무시하고, 버전 줄 탭 처리가 없다', async () => {
  render(<DevMenuHost api={createFakeApi()}>{() => <Opener />}</DevMenuHost>);
  await act(async () => {
    fireEvent.press(screen.getByText('열기'));
  });
  expect(screen.queryByTestId('dev-menu')).toBeNull();
  expect(screen.getByTestId('tap-state')).toHaveTextContent('plain');
});

test('production 설정 화면의 버전 줄은 Pressable 이 아니다(화면 읽기에 사용 안 함으로 읽히지 않게)', async () => {
  const {ChildAppInfo} = require('../src/features/child/ChildAppInfo');
  const {NavigationContainer} = require('@react-navigation/native');
  const {createNativeStackNavigator} = require('@react-navigation/native-stack');
  const Stack = createNativeStackNavigator();
  render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="AppInfo" component={ChildAppInfo} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  expect(await screen.findByTestId('version-line')).toBeTruthy();
  expect(screen.queryByTestId('version-tap')).toBeNull();
  expect(screen.getByTestId('version-line').props.accessibilityState?.disabled).toBeUndefined();
});
