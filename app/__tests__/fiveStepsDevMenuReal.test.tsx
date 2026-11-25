// 리드 결정(#254 M1): 서버 계약(server/five-steps) 병합 전에는 실서버(real) 모드에서 5단계 스위치를 켤 수 없다.
// 실서버는 recall·pass_on 단계 기록을 invalid_step 으로 거절해 ②에서 멈추기 때문(방어는 useFinishStep newStepNotAccepted).
import React, {useContext} from 'react';
import {Pressable, Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {DevMenuHost} from '../src/dev/DevMenuHost';
import {DevMenuContext} from '../src/dev/devGate';
import {createFakeApi} from '../src/features/fakeApi';
import {isFeatureOn, resetFeaturesForTest} from '../src/lib/features';

jest.mock('../src/lib/env', () => {
  const actual = jest.requireActual('../src/lib/env');
  return {...actual, getAppEnv: () => ({...actual.DEFAULT_ENV, APP_ENV: 'staging', API_MODE: 'real'})};
});
afterEach(() => resetFeaturesForTest());

function OpenMenu() {
  const {open} = useContext(DevMenuContext);
  return (
    <Pressable accessibilityRole="button" onPress={open}>
      <Text>메뉴 열기</Text>
    </Pressable>
  );
}

test('실서버 모드: "오늘 코스 4단계 켜기"는 비활성 + "실서버 모드에서는 아직 켤 수 없어요" 안내, 눌러도 꺼진 채', async () => {
  render(<DevMenuHost api={createFakeApi()}>{() => <OpenMenu />}</DevMenuHost>);
  await waitFor(() => screen.getByRole('button', {name: '메뉴 열기'}));
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '메뉴 열기'}));
  });
  const btn = screen.getByRole('button', {name: '오늘 코스 4단계 켜기(기능 스위치)'});
  expect(btn.props.accessibilityState?.disabled).toBe(true);
  expect(screen.getByText(/실서버 모드에서는 아직 켤 수 없어요/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(btn);
  });
  expect(isFeatureOn('fiveSteps')).toBe(false);
});
