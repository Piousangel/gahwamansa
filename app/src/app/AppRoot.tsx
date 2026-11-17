import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AppState, StatusBar, StyleSheet, useWindowDimensions, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {initialWindowMetrics, SafeAreaProvider} from 'react-native-safe-area-context';
import type {Api, StepName, TodayContent} from '../features/types';
import {SessionContext} from './session';
import {ParentStack} from './ParentStack';
import {ChildStack} from './ChildStack';
import {RoleSelect} from '../features/link/RoleSelect';
import {BigButton} from '../ui/BigButton';
import {Screen} from '../ui/Screen';
import {Text20} from '../ui/Text20';
import {appCopy, offlineMessage, Message} from '../copy/copy';
import {errorMessage} from '../features/course/useFinishStep';
import {useMotionMode} from '../features/link/useReduceMotion';
import {color} from '../ui/tokens';
import {finishFlight, flightPending, hideNativeSplash, kickBoot, useBootActive, useBootLoading, useSplashLanded, useSplashTarget} from './splash';
import {SplashHold, SplashOverlay} from './SplashOverlay';

export type Role = 'parent' | 'child';
type Start = 'loading' | 'Connect' | 'CourseHome' | 'offline';

// 역할에 따라 어르신 스택 / 자녀 스택 분기. role 을 주지 않으면 첫 화면에서 역할을 고른다(P0·C0).
// restore: 시작 시 서버에서 이 기기 상태(연결된 어르신 / 로그인한 자녀 / 없음)를 확인해 첫 화면을 정한다(real 모드).
export function AppRoot({api, role, restore = false}: {api: Api; role?: Role; restore?: boolean}) {
  const [content, setContent] = useState<TodayContent | null | undefined>(undefined);
  const [who, setWho] = useState<Role | null | 'loading'>(role ?? (restore ? 'loading' : null));
  const [start, setStart] = useState<Start>(restore && role !== 'child' ? 'loading' : 'Connect');
  const [tick, setTick] = useState(0);
  const contentRef = useRef(content);
  contentRef.current = content;

  // 서버에서 오늘 상태를 다시 불러오는 유일한 경로. 실패는 syncError 하나로 알리고(오프라인/서버 오류 구분),
  // 화면은 이전 값을 유지한다. 성공하면 새 값을, 실패하면 undefined 를 돌려준다.
  const [syncError, setSyncError] = useState<Message | null>(null);
  // first=true 는 코스 홈 진입(start_today, 0024: 날짜가 바뀐 첫 호출에만 콘텐츠 커서 전진). 나머지 다시 받기는 읽기 전용.
  const load = useCallback(async (first: boolean): Promise<TodayContent | null | undefined> => {
    try {
      const next = await (first ? api.startToday() : api.getTodayContent());
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
  const sync = useCallback(() => load(false), [load]);
  const startToday = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (!restore || role === 'child') {
      return;
    }
    let alive = true;
    api
      .whoAmI()
      .then(w => {
        if (!alive) {
          return;
        }
        // 역할이 지정돼 있으면(어르신 전용 실행) 그 역할을 유지하고 첫 화면만 정한다
        setWho(role ?? (w === 'none' ? null : w));
        setStart(w === 'parent' ? 'CourseHome' : 'Connect');
      })
      .catch(() => {
        if (alive) {
          setStart('offline');
        }
      });
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
      startToday,
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
      resetRole: () => {
        setContent(undefined);
        setStart('Connect');
        setWho(null);
      },
    }),
    [api, content, syncError, sync, startToday],
  );

  // 스플래시 이어가기: 시작 대기(어느 경로든 첫 로딩)는 이 한 곳의 심볼 대기 화면만 보인다.
  // 2초가 넘으면 심볼 아래에만 "잠시만요". 대기가 끝나면 심볼을 첫 화면으로 넘긴다(실행당 한 번).
  const win = useWindowDimensions();
  const waiting = start !== 'offline' && (start === 'loading' || who === 'loading'); // 오프라인 화면은 대기가 아님
  useBootLoading(waiting);
  useLayoutEffect(kickBoot, []);
  const boot = useBootActive();
  const hold = boot || waiting;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!hold) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 2000);
    return () => clearTimeout(t);
  }, [hold]);
  const motion = useMotionMode();
  const target = useSplashTarget();
  const landed = useSplashLanded();
  const [flying] = useState(flightPending);
  const showFlight = flying && !landed && !hold && start !== 'offline';
  // 첫 화면(역할 선택)으로 갈 때만 자리 이동, 바로 홈으로 가면 페이드(목표 없음 → 동작 줄이기와 같은 300ms)
  const flightMode = who === null ? motion : motion === null ? null : motion === 'none' ? 'none' : 'reduce';

  let body: React.ReactNode;
  if (start === 'offline') {
    body = (
      <Screen>
        <Text20 size={24} weight="bold">{offlineMessage.title}</Text20>
        <Text20>{offlineMessage.body}</Text20>
        <BigButton
          variant="secondary"
          label={offlineMessage.button}
          onPress={() => {
            setStart('loading');
            if (!role) {
              setWho('loading');
            }
            setTick(t => t + 1);
          }}
        />
      </Screen>
    );
  } else if (who === 'child') {
    body = <ChildStack initialRouteName={role === 'child' ? 'Tabs' : 'Gate'} />;
  } else if (waiting) {
    body = null; // 아래 SplashHold 가 덮는다
  } else if (who === null) {
    body = (
      <RoleSelect
        onChoose={r => {
          setStart('Connect');
          setWho(r);
        }}
      />
    );
  } else {
    body = <ParentStack initialRouteName={start} />;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {/* 종이색 배경 위라 시계·배터리 아이콘을 어둡게(앱 전체 라이트) */}
      <StatusBar barStyle="dark-content" />
      <View testID="app-root" style={styles.root} onLayout={hideNativeSplash}>
        {/* 시작 대기 중에는 뒤 화면을 화면 읽기에서 숨긴다(덮개만 읽힘) */}
        <View style={styles.root} importantForAccessibility={hold ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={hold}>
          <SessionContext.Provider value={value}>
            <NavigationContainer>{body}</NavigationContainer>
          </SessionContext.Provider>
        </View>
        {hold ? (
          <SplashHold
            win={win}
            slowText={
              slow ? (
                <Text20 accessibilityLiveRegion="polite" maxFontSizeMultiplier={2} style={styles.slow}>
                  {appCopy.loading}
                </Text20>
              ) : null
            }
          />
        ) : null}
        {showFlight ? <SplashOverlay win={win} target={who === null ? target : null} mode={flightMode} onDone={finishFlight} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: color.paper},
  slow: {color: color.inkSub, textAlign: 'center'},
});
