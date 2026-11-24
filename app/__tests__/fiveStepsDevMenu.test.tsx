// 기능 스위치 fiveSteps 를 켜는 길: staging·개발 빌드의 개발자 메뉴만(production 대역에는 메뉴 자체가 없다 — devMenu.test).
import React, {useContext} from 'react';
import {Pressable, Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {DevMenuHost} from '../src/dev/DevMenuHost';
import {DevMenuContext} from '../src/dev/devGate';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {isFeatureOn, resetFeaturesForTest} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';

beforeEach(async () => {
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
});

function OpenMenu() {
  const {open} = useContext(DevMenuContext);
  return (
    <Pressable accessibilityRole="button" onPress={open}>
      <Text>메뉴 열기</Text>
    </Pressable>
  );
}

test('개발자 메뉴 "오늘 코스 5단계 켜기" → 스위치 켜짐 + 앱을 처음부터 → 코스 홈 5행, 다시 누르면 3행', async () => {
  const api = createFakeApi({linked: true, consented: true});
  render(
    <DevMenuHost api={api}>
      {({appKey}) => (
        <>
          <OpenMenu />
          <AppRoot key={appKey} api={api} role="parent" restore />
        </>
      )}
    </DevMenuHost>,
  );
  await waitFor(() => screen.getByTestId('date-line'));
  expect(screen.queryByTestId('step-wait-recall')).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '메뉴 열기'}));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '오늘 코스 5단계 켜기(기능 스위치)'}));
  });
  expect(isFeatureOn('fiveSteps')).toBe(true);
  await waitFor(() => screen.getByTestId('step-wait-recall'));
  expect(screen.getByTestId('step-wait-pass_on')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '메뉴 열기'}));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '오늘 코스 5단계 끄기(3단계로)'}));
  });
  expect(isFeatureOn('fiveSteps')).toBe(false);
  await waitFor(() => screen.getByTestId('step-wait-hangul'));
  expect(screen.queryByTestId('step-wait-recall')).toBeNull();
});
