import React, {useMemo, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {Api, StepName, TodayContent} from '../features/types';
import {SessionContext} from './session';
import {ParentStack} from './ParentStack';
import {ChildTabs} from './ChildTabs';

export type Role = 'parent' | 'child';

// 역할(mock)에 따라 어르신 스택 / 자녀 탭 분기. 실제 역할은 서버 연동 단계에서 profiles.role 로 대체.
export function AppRoot({api, role}: {api: Api; role: Role}) {
  const [consented, setConsented] = useState(false);
  const [done, setDone] = useState<StepName[]>([]);
  const [streak, setStreak] = useState(0);
  const [content, setContent] = useState<TodayContent | null | undefined>(undefined);
  const value = useMemo(
    () => ({
      api, consented, setConsented, done, streak, setStreak, content, setContent,
      markDone: (s: StepName) => setDone(d => (d.includes(s) ? d : [...d, s])),
    }),
    [api, consented, done, streak, content],
  );
  return (
    <SafeAreaProvider>
      <SessionContext.Provider value={value}>
        <NavigationContainer>{role === 'parent' ? <ParentStack /> : <ChildTabs />}</NavigationContainer>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}
