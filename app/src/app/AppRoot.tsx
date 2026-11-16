import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {Api, StepName, TodayContent} from '../features/types';
import {SessionContext} from './session';
import {ParentStack} from './ParentStack';
import {ChildTabs} from './ChildTabs';
import {BigButton} from '../ui/BigButton';
import {Screen} from '../ui/Screen';
import {Text20} from '../ui/Text20';
import {appCopy, offlineMessage} from '../copy/copy';

export type Role = 'parent' | 'child';
type Start = 'loading' | 'Connect' | 'CourseHome' | 'offline';

// 역할(mock)에 따라 어르신 스택 / 자녀 탭 분기. 실제 역할은 서버 연동 단계에서 profiles.role 로 대체.
// restore: 시작 시 서버에서 연결 여부를 확인해 첫 화면을 정한다(real 모드).
export function AppRoot({api, role, restore = false}: {api: Api; role: Role; restore?: boolean}) {
  const [content, setContent] = useState<TodayContent | null | undefined>(undefined);
  const [start, setStart] = useState<Start>(restore && role === 'parent' ? 'loading' : 'Connect');
  const [tick, setTick] = useState(0);
  const contentRef = useRef(content);
  contentRef.current = content;

  const refresh = useCallback(async () => {
    const c = await api.getTodayContent();
    setContent(c);
    return c;
  }, [api]);

  useEffect(() => {
    if (!(restore && role === 'parent')) {
      return;
    }
    let alive = true;
    api
      .restoreSession()
      .then(r => alive && setStart(r === 'linked' ? 'CourseHome' : 'Connect'))
      .catch(() => alive && setStart('offline'));
    return () => {
      alive = false;
    };
  }, [api, restore, role, tick]);

  // 포그라운드 복귀: 코스 상태(날짜가 바뀌었을 수도 있음)를 서버 기준으로 다시 맞춘다.
  useEffect(() => {
    if (role !== 'parent') {
      return;
    }
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && contentRef.current !== undefined) {
        refresh().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [role, refresh]);

  const value = useMemo(
    () => ({
      api,
      content,
      consented: content?.consented ?? false,
      done: content?.completed_steps ?? [],
      streak: content?.streak ?? 0,
      refresh,
      applyStep: (step: StepName, streak: number) =>
        setContent(c =>
          c
            ? {
                ...c,
                streak,
                completed_steps: c.completed_steps.includes(step) ? c.completed_steps : [...c.completed_steps, step],
              }
            : c,
        ),
      applyConsent: () => setContent(c => (c ? {...c, consented: true} : c)),
    }),
    [api, content, refresh],
  );

  let body: React.ReactNode;
  if (role === 'child') {
    body = <ChildTabs />;
  } else if (start === 'loading') {
    body = (
      <Screen>
        <Text20>{appCopy.loading}</Text20>
      </Screen>
    );
  } else if (start === 'offline') {
    body = (
      <Screen>
        <Text20 size={24} weight="bold">{offlineMessage.title}</Text20>
        <Text20>{offlineMessage.body}</Text20>
        <BigButton
          variant="secondary"
          label={offlineMessage.button}
          onPress={() => {
            setStart('loading');
            setTick(t => t + 1);
          }}
        />
      </Screen>
    );
  } else {
    body = <ParentStack initialRouteName={start} />;
  }

  return (
    <SafeAreaProvider>
      <SessionContext.Provider value={value}>
        <NavigationContainer>{body}</NavigationContainer>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}
