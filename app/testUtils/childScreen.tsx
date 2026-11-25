import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {initialWindowMetrics, SafeAreaProvider} from 'react-native-safe-area-context';
import {render, screen, waitFor} from '@testing-library/react-native';
import {ChildStack, type ChildParams} from '../src/app/ChildStack';
import {SessionContext, type Session} from '../src/app/session';
import {EMPTY_PICKS} from '../src/features/course/fiveSteps';
import {createFakeApi} from '../src/features/fakeApi';
import type {Api} from '../src/features/types';
import {useScreenPush} from './parentScreen';

/**
 * 자녀 스택의 한 화면(C7 설정 등)을 앱 전체(AppRoot: 역할 분기·스플래시·앨범 탭) 없이 바로 그린다(대기열 71, renderParentScreen 의 자녀 짝).
 * 진짜 ChildStack 을 initialRouteName 으로 열어 그 화면에서 다른 화면(AppInfo·DeleteAccount·Code 등)으로 가는 것까지 그대로 된다.
 * 세션은 AppRoot 가 자녀에게 주는 모양과 같다(자녀는 오늘 콘텐츠를 쓰지 않아 content 는 undefined).
 * resetRole·clear 는 AppRoot 에서 역할 선택으로 돌아가거나 기기 기억값을 지우는 일이라 여기선 아무것도 하지 않는다.
 *
 * 쓰지 말 것: 앨범 → 설정 같은 '이동 자체', 로그아웃·계정 삭제 뒤 역할 선택 화면으로 가는 것, 알림 탭(PushHost)을 검사하는 테스트 — 그건 AppRoot 로 그린다.
 */
function Harness({api, route}: {api: Api; route: keyof ChildParams}) {
  useScreenPush(api);
  const value = React.useMemo<Session>(() => {
    const sync = async () => undefined;
    return {
      api,
      content: undefined,
      consented: false,
      done: [],
      streak: 0,
      sync,
      startToday: sync,
      syncError: null,
      applyStep: () => {},
      applyAnswer: () => {},
      setConsented: () => {},
      five: false,
      picks: EMPTY_PICKS,
      setPicks: () => {},
      applySaved: () => {},
      clear: () => {},
      resetRole: () => {},
    };
  }, [api]);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SessionContext.Provider value={value}>
        <NavigationContainer>
          <ChildStack initialRouteName={route} />
        </NavigationContainer>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}

/**
 * 자녀 스택의 route 화면을 바로 그린다. 기본은 어르신 '엄마'와 연결된 자녀의 C7 설정.
 * ready: 화면이 다 그려졌다고 볼 조건(기본: C7 의 '부르는 이름' 행 — 요약을 받아 와야 보인다). 문자열은 testID, 함수면 그대로 waitFor 에 넘긴다.
 */
export async function renderChildScreen({
  route = 'Settings',
  api = createFakeApi({consented: true, parentTitle: '엄마'}),
  ready = () => screen.getAllByRole('button', {name: /^부르는 이름/}), // 글자 대신 버튼 이름(Android 렌더는 글자 사이에 줄바꿈 막는 문자가 들어간다)
}: {route?: keyof ChildParams; api?: Api; ready?: string | (() => unknown)} = {}) {
  const r = render(<Harness api={api} route={route} />);
  await waitFor(typeof ready === 'string' ? () => screen.getByTestId(ready) : ready);
  return r;
}
