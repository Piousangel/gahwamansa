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
import {DEV_FEATURE_KEY} from '../src/lib/features';

// 기기 저장소: 메뉴가 쓰고 다음 시작 때 읽는 같은 저장소(jest 에는 AsyncStorage 네이티브가 없어 공유 메모리로 바꾼다)
const mockShared = (() => {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
  };
})();
jest.mock('../src/lib/kvStore', () => ({...jest.requireActual('../src/lib/kvStore'), defaultStore: () => mockShared}));

beforeEach(async () => {
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
});
afterEach(() => {
  mockShared.clear();
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

test('개발자 메뉴 "오늘 코스 4단계 켜기" → 스위치 켜짐 + 앱을 처음부터 → 코스 홈 4행(⑤ 없음), 다시 누르면 3행', async () => {
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
    fireEvent.press(screen.getByRole('button', {name: '오늘 코스 4단계 켜기(기능 스위치)'}));
  });
  expect(isFeatureOn('fiveSteps')).toBe(true);
  await waitFor(() => screen.getByTestId('step-wait-recall'));
  expect(screen.getByTestId('step-wait-hangul')).toBeTruthy();
  expect(screen.queryByTestId('step-wait-pass_on')).toBeNull(); // 기획 v2.1 Q7: ⑤ 행 없음
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '메뉴 열기'}));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', {name: '오늘 코스 4단계 끄기(3단계로)'}));
  });
  expect(isFeatureOn('fiveSteps')).toBe(false);
  await waitFor(() => screen.getByTestId('step-wait-hangul'));
  expect(screen.queryByTestId('step-wait-recall')).toBeNull();
});

test('QA-1 L3: 메뉴가 남긴 "켜짐"은 앱을 그리기 전에 읽는다 — 처음 그린 코스 홈부터 4행, 3단계로 먼저 그리지 않는다', async () => {
  await mockShared.setItem(DEV_FEATURE_KEY, 'on');
  const api = createFakeApi({linked: true, consented: true});
  const mounts: boolean[] = [];
  function Probe() {
    mounts.push(isFeatureOn('fiveSteps'));
    return null;
  }
  render(
    <DevMenuHost api={api}>
      {({appKey}) => (
        <>
          <Probe />
          <AppRoot key={appKey} api={api} role="parent" restore />
        </>
      )}
    </DevMenuHost>,
  );
  await waitFor(() => screen.getByTestId('step-wait-recall'));
  expect(mounts.length).toBeGreaterThan(0);
  expect(mounts.every(Boolean)).toBe(true); // 꺼진 채 그린 적이 없다
});
