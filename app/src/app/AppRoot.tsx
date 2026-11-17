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
import {appCopy, offlineMessage, Message} from '../copy/copy';
import {errorMessage} from '../features/course/useFinishStep';

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

  // 서버에서 오늘 상태를 다시 불러오는 유일한 경로. 실패는 syncError 하나로 알리고(오프라인/서버 오류 구분),
  // 화면은 이전 값을 유지한다. 성공하면 새 값을, 실패하면 undefined 를 돌려준다.
  const [syncError, setSyncError] = useState<Message | null>(null);
  const sync = useCallback(async (): Promise<TodayContent | null | undefined> => {
    try {
      const next = await api.getTodayContent();
      // 미연결 열람은 단계를 서버에 기록하지 않으므로, 같은 날 다시 불러와도 화면에서 한 단계를 지우지 않는다.
      setContent(prev =>
        next && !next.linked && prev && !prev.linked && prev.day_index === next.day_index
          ? {...next, completed_steps: prev.completed_steps}
          : next,
      );
      setSyncError(null);
      return next;
    } catch (e) {
      setSyncError(errorMessage(e));
      return undefined;
    }
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
        sync();
      }
    });
    return () => sub.remove();
  }, [role, sync]);

  const value = useMemo(
    () => ({
      api,
      content,
      consented: content?.consented ?? false,
      done: content?.completed_steps ?? [],
      streak: content?.streak ?? 0,
      sync,
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
      setConsented: (v: boolean) => {
        if (contentRef.current) {
          setContent(c => (c ? {...c, consented: v, answered_choice: v ? c.answered_choice : null} : c));
        } else {
          sync(); // 콘텐츠가 없으면(null·불러오는 중) 동의 상태를 서버에서 다시 받는다
        }
      },
      syncError,
      clear: () => setContent(undefined),
    }),
    [api, content, syncError, sync],
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
