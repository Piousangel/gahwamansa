// 개발자 메뉴(staging·local 개발 빌드 전용). production 번들에서는 Metro 가 DevMenuHost.stub.tsx 로 바꿔 이 파일·
// sessionSlots·testFamily 가 빠진다(metroDevMenu.js, scripts/check-dev-menu-bundle.sh 로 확인). 실행 중에도 관문(devGate)이 한 번 더 막는다.
// 문구는 내부 도구라 copy.ko.json 에 두지 않는다(사용자에게 보이지 않음). 비밀번호·토큰·번호는 화면·로그에 찍지 않는다.
import React, {useCallback, useMemo, useState} from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';
import type {Api} from '../features/types';
import {getAppEnv} from '../lib/env';
import {localStamps} from '../lib/localStamps';
import {Text20} from '../ui/Text20';
import {BigButton} from '../ui/BigButton';
import {color, radius} from '../ui/tokens';
import {DevMenuContext, isDevMenuAllowed} from './devGate';
import {createSessionSlots, type DevRole} from './sessionSlots';
import {createTestFamily, supabaseDevAuth} from './testFamily';
import type {FakeDevHooks} from '../features/fakeApi';

// 번들 검사 표식(scripts/check-dev-menu-bundle.sh): production 번들에 이 글자가 있으면 실패
export const DEV_MENU_IMPL_MARKER = 'bumojasik-dev-menu-impl';

const T = {
  title: '개발자 메뉴',
  env: '환경',
  role: '역할 전환(세션은 역할별로 따로 보관)',
  toParent: '어르신으로',
  toChild: '자녀로',
  family: '테스트 가족 만들기',
  familyHint: '자녀(config.local 테스트 계정 또는 보관된 자녀 세션) → 번호 → 어르신 익명 연결',
  course: '오늘 코스',
  reset: '오늘 코스 초기화',
  nextDay: '하루 넘기기',
  serverOnly: '서버 기록·날짜는 앱에서 바꿀 수 없어요. 로컬 DB면 SQL 로(supabase/README)',
  stamps: '이 기기 도장(미연결) 지우기',
  close: '닫기',
  done: '했어요',
  noChild: '자녀 세션이 없어요. 자녀로 로그인한 뒤 다시 해 주세요',
  failed: '실패했어요',
};

type Role = 'parent' | 'child';
type Props = {api: Api; children: (p: {appKey: number; role?: Role}) => React.ReactNode};

// 개발 빌드 config.local.ts 의 테스트 자녀 계정(gitignore). release·없으면 undefined
function localTestChild(): {email: string; password: string} | undefined {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return undefined;
  }
  try {
    const c = require('../lib/config.local').devTestChild;
    return c && typeof c.email === 'string' && typeof c.password === 'string' ? c : undefined;
  } catch {
    return undefined;
  }
}

function realDeps() {
  const {getSupabase} = require('../lib/supabase');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return {auth: supabaseDevAuth(getSupabase().auth), store: AsyncStorage};
}

export function DevMenuHost({api, children}: Props) {
  const env = getAppEnv();
  const allowed = isDevMenuAllowed(env.APP_ENV, typeof __DEV__ === 'undefined' ? true : __DEV__);
  const [visible, setVisible] = useState(false);
  const [appKey, setAppKey] = useState(0);
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fake = env.API_MODE === 'fake';
  const dev = (api as Api & {__dev?: FakeDevHooks}).__dev;

  const restart = useCallback((r?: Role) => {
    setVisible(false);
    setMsg(null);
    setRole(r);
    setAppKey(k => k + 1); // 화면 스택을 처음부터(AppRoot 다시 마운트)
  }, []);

  const run = async (f: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await f();
    } catch {
      setMsg(T.failed); // 오류 내용에는 토큰·번호가 섞일 수 있어 그대로 보여 주지 않는다
    } finally {
      setBusy(false);
    }
  };

  const switchRole = (to: DevRole) =>
    run(async () => {
      if (fake) {
        restart(to); // fake 는 서버 세션이 없다: 역할만 바꿔 처음부터
        return;
      }
      const who = await api.whoAmI();
      await createSessionSlots(realDeps().auth, realDeps().store).switchTo(who, to);
      restart(undefined); // real: 복원된 세션 기준으로 시작 화면을 다시 정한다
    });

  const makeFamily = () =>
    run(async () => {
      const {auth, store} = realDeps();
      const r = await createTestFamily({api, auth, store, creds: localTestChild()});
      if (!r.ok) {
        setMsg(r.reason === 'no_child_session' ? T.noChild : T.failed);
        return;
      }
      restart(undefined);
    });

  const ctx = useMemo(() => ({open: () => (allowed ? setVisible(true) : undefined)}), [allowed]);

  return (
    <DevMenuContext.Provider value={ctx}>
      {children({appKey, role})}
      {allowed && visible ? (
        <Modal visible transparent animationType="none" onRequestClose={() => setVisible(false)}>
          <View style={styles.scrim}>
            <View style={styles.card} testID="dev-menu" accessibilityLabel={DEV_MENU_IMPL_MARKER}>
              <ScrollView contentContainerStyle={styles.body}>
                <Text20 size={28} weight="bold" accessibilityRole="header">{T.title}</Text20>
                <Text20 weight="bold">{T.env}</Text20>
                <Text20>{`APP_ENV ${env.APP_ENV} · API_MODE ${env.API_MODE}`}</Text20>
                <Text20>{`서버 ${env.SUPABASE_URL || '(없음)'}`}</Text20>
                <Text20>{`버전 ${env.VERSION_NAME || '(개발)'} (${env.VERSION_CODE ?? '-'}) ${env.GIT_SHA}`}</Text20>
                <Text20>{`링크 도메인 ${env.APP_LINK_HOST || '(없음)'}`}</Text20>

                <Text20 weight="bold">{T.role}</Text20>
                <BigButton variant="secondary" label={T.toParent} disabled={busy} onPress={() => switchRole('parent')} />
                <BigButton variant="secondary" label={T.toChild} disabled={busy} onPress={() => switchRole('child')} />

                {fake ? null : (
                  <>
                    <Text20 weight="bold">{T.family}</Text20>
                    <Text20>{T.familyHint}</Text20>
                    <BigButton variant="secondary" label={T.family} loading={busy} onPress={makeFamily} />
                  </>
                )}

                <Text20 weight="bold">{T.course}</Text20>
                {dev ? (
                  <>
                    <BigButton variant="secondary" label={T.reset} onPress={() => {
                      dev.resetToday();
                      restart(role);
                    }} />
                    <BigButton variant="secondary" label={T.nextDay} onPress={() => {
                      dev.nextDay();
                      restart(role);
                    }} />
                  </>
                ) : (
                  <Text20>{T.serverOnly}</Text20>
                )}
                <BigButton variant="secondary" label={T.stamps} onPress={() => run(async () => {
                  await localStamps().clear();
                  setMsg(T.done);
                })} />

                {msg ? <Text20 weight="bold" accessibilityLiveRegion="polite">{msg}</Text20> : null}
                <BigButton label={T.close} onPress={() => setVisible(false)} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </DevMenuContext.Provider>
  );
}

const styles = StyleSheet.create({
  scrim: {flex: 1, backgroundColor: color.scrim, justifyContent: 'center', padding: 16},
  card: {backgroundColor: color.paper, borderRadius: radius.sheet, maxHeight: '92%'},
  body: {padding: 20, gap: 8},
});
