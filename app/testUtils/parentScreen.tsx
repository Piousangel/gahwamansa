import React, {useMemo, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {initialWindowMetrics, SafeAreaProvider} from 'react-native-safe-area-context';
import {render, screen, waitFor} from '@testing-library/react-native';
import {ParentStack, type ParentParams} from '../src/app/ParentStack';
import {SessionContext, type Session} from '../src/app/session';
import {EMPTY_PICKS} from '../src/features/course/fiveSteps';
import {createFakeApi} from '../src/features/fakeApi';
import type {Api, TodayContent} from '../src/features/types';
import {getAppEnv} from '../src/lib/env';
import {configurePush} from '../src/push/runtime';
import {pickTokenSource} from '../src/push/tokenSource';

/**
 * 푸시 실행 의존성(push/runtime)을 이 api 로 채운다 — AppRoot 에서는 PushHost 가 하는 일(대기열 71).
 * P13 알림 행·C7 '가족 연결' 토글이 pushReceive()·setPushReceive() 로 이 값을 쓴다. 안 채우면 앞 테스트의 api 가 남아 순서에 기대게 된다.
 * PushHost 의 다른 일(채널 만들기·토큰 등록·N1·알림 탭 이동)은 하지 않는다 — 그걸 보는 테스트는 AppRoot 로 그린다.
 */
export function useScreenPush(api: Api) {
  React.useMemo(() => configurePush(api, pickTokenSource(getAppEnv().API_MODE)), [api]);
}

/**
 * 어르신 스택의 한 화면(설정 등)을 앱 전체(AppRoot: 시작 확인·스플래시·코스 홈) 없이 바로 그린다(대기열 67, QA-1 L2).
 * 진짜 ParentStack 을 initialRouteName 으로 열어 그 화면에서 다른 화면(Oss·Web 등)으로 가고 돌아오는 것까지 그대로 된다.
 * 세션은 AppRoot 와 같은 모양을 가짜 API 의 오늘 콘텐츠로 채운다(동의 바꾸기·다시 받기는 화면 상태에 반영, 5단계는 꺼짐).
 *
 * 쓰지 말 것: 홈 → 설정 같은 '이동 자체'나 시작 확인(restore)·스플래시를 검사하는 테스트 — 그건 AppRoot 로 그린다.
 */
function Harness({api, initial, route}: {api: Api; initial: TodayContent | null; route: keyof ParentParams}) {
  useScreenPush(api);
  const [content, setContent] = useState<TodayContent | null | undefined>(initial);
  const value = useMemo<Session>(() => {
    const sync = async () => {
      const next = await api.getTodayContent();
      setContent(next);
      return next;
    };
    return {
      api,
      content,
      consented: content?.consented ?? false,
      done: content?.completed_steps ?? [],
      streak: content?.streak ?? 0,
      sync,
      startToday: sync,
      syncError: null,
      applyStep: () => {},
      applyAnswer: choice => setContent(c => (c ? {...c, answered_choice: choice} : c)),
      setConsented: v => setContent(c => (c ? {...c, consented: v, answered_choice: v ? c.answered_choice : null} : c)),
      five: false,
      picks: EMPTY_PICKS,
      setPicks: () => {},
      applySaved: () => {},
      clear: () => setContent(undefined),
      resetRole: () => {},
    };
  }, [api, content]);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SessionContext.Provider value={value}>
        <NavigationContainer>
          <ParentStack initialRouteName={route} />
        </NavigationContainer>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}

/** 어르신 스택의 route 화면을 바로 그린다. 기본은 연결·동의한 기기의 설정(P13). 화면의 testID 하나(ready)가 보일 때까지 기다린다. */
export async function renderParentScreen({
  route = 'Settings',
  api = createFakeApi({linked: true, consented: true}),
  ready = 'settings-row-oss',
}: {route?: keyof ParentParams; api?: Api; ready?: string} = {}) {
  const initial = await api.getTodayContent();
  const r = render(<Harness api={api} initial={initial} route={route} />);
  await waitFor(() => screen.getByTestId(ready));
  return r;
}

/**
 * flow.toHome·toHomeConsented(번호 입력 → 코스 홈) 뒤 '설정'을 누른 것과 같은 서버 상태에서 설정만 바로 그린다(대기열 71).
 * 가짜 API 에 번호로 이 기기를 연결해 두고(화면에서 '이 번호로 연결하기'를 누른 것과 같은 호출) 설정(P13)을 연다.
 */
export async function renderLinkedSettings(api: Api, code = '123456') {
  await api.redeemInviteCode(code);
  return renderParentScreen({api});
}
