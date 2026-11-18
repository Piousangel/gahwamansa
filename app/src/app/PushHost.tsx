import {useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {parsePushKind, type PushKind} from '../api/contract/push';
import {isQuietEventFailure} from '../api/contract/events';
import {getAppEnv} from '../lib/env';
import {navRef, useCurrentRouteName} from '../navigation/navRef';
import {pushChannelSpecs} from '../push/channels';
import {ensureChannels, readNotifyPermission} from '../push/notifyNative';
import {isParentKind, parentStepAfterOpen} from '../push/openRoute';
import {childPermissionGranted, registerToken, retryPending, shouldPromptParent} from '../push/pushClient';
import {configurePush} from '../push/runtime';
import {pickTokenSource, type PushData, type PushTokenSource} from '../push/tokenSource';
import {handleChildPushOpen} from '../features/home/pushOpen';
import {useSession} from './session';

type Role = 'parent' | 'child' | null | 'loading';
const TAB_ROUTES = ['Album', 'Past']; // 자녀 탭 안 화면(getCurrentRoute 는 가장 안쪽 이름을 준다)

// 푸시 조립(AU-04): 채널 만들기 · 토큰 등록·갱신 · 어르신 N1 띄우기 · 알림 탭 라우팅(U1·AC-03) · push_opened.
// 화면을 그리지 않는다. 토큰 공급자는 API 모드로 고른다(fake 모드 = 가짜 토큰, real = Firebase(US-10) 전까지 없음).
export function PushHost({role, source: given}: {role: Role; source?: PushTokenSource}) {
  const {api, content, consented} = useSession();
  const source = useMemo(() => given ?? pickTokenSource(getAppEnv().API_MODE), [given]);
  const deps = useMemo(() => configurePush(api, source), [api, source]);
  const route = useCurrentRouteName();
  const linked = content?.linked ?? false;

  useEffect(() => {
    ensureChannels(pushChannelSpecs());
  }, []);

  // 토큰 등록(권한이 있을 때만): 앱 시작·연결이 바뀔 때·앞으로 돌아올 때·토큰 갱신 때. 프로필이 없으면(no_profile) 다음 기회에.
  const ready = role === 'child' || (role === 'parent' && linked);
  useEffect(() => {
    if (!ready) {
      return;
    }
    const sync = async () => {
      if ((await readNotifyPermission()) !== 'granted') {
        return;
      }
      if (role === 'child') {
        await childPermissionGranted(deps); // 이 계정에서 처음 확인한 허용이면 받기 동의도(한 번)
      } else {
        await retryPending(deps);
        await registerToken(deps);
      }
    };
    sync();
    const app = AppState.addEventListener('change', s => {
      if (s === 'active') {
        sync();
      }
    });
    const refresh = source.onTokenRefresh(() => {
      sync();
    });
    return () => {
      app.remove();
      refresh();
    };
  }, [ready, role, deps, source]);

  // 알림 탭: 받은 data 를 잠시 두고, 그 역할의 화면이 준비되면 처리한다(꺼진 앱을 알림으로 연 경우 포함)
  const [pending, setPending] = useState<{data: PushData; kind: PushKind | null; stage: 'open' | 'step'} | null>(null);
  useEffect(() => {
    const take = (data: PushData) => setPending({data, kind: parsePushKind(data), stage: 'open'});
    let alive = true;
    source
      .getInitialOpen()
      .then(d => {
        if (alive && d) {
          take(d);
        }
      })
      .catch(() => {});
    const off = source.onOpen(take);
    return () => {
      alive = false;
      off();
    };
  }, [source]);

  useEffect(() => {
    if (!pending || role === 'loading' || !navRef.isReady()) {
      return;
    }
    const {data, kind, stage} = pending;
    if (role === 'child') {
      // 연결 알림 → 앨범 탭(로그인·대기 전 화면에서는 이동하지 않는다: 대기 화면은 연결되면 스스로 넘어간다)
      if (route && TAB_ROUTES.includes(route)) {
        handleChildPushOpen(api, data, () => navRef.navigate('Tabs', {screen: 'Album'}));
        setPending(null);
      } else if (route === 'Wait') {
        handleChildPushOpen(api, data, () => {});
        setPending(null);
      }
      return;
    }
    if (role !== 'parent' || !kind || !isParentKind(kind)) {
      setPending(null); // 역할 선택 화면·모르는 종류·다른 역할 알림은 버린다
      return;
    }
    if (stage === 'open') {
      api
        .logEvent('push_opened', {push_kind: kind})
        .then(r => {
          if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
            console.warn(`[log_event] push_opened: ${r.reason}`);
          }
        })
        .catch(() => {});
      // [P3] 하나로 맞춘다(어느 화면에 있었든). 단계는 P3 가 오늘 콘텐츠를 받은 뒤 위에 쌓는다
      navRef.reset({index: 0, routes: [{name: 'CourseHome'}]});
      setPending({data, kind, stage: 'step'});
      return;
    }
    if (route === 'CourseHome' && content !== undefined) {
      const step = parentStepAfterOpen(kind, content);
      if (step) {
        navRef.navigate(step);
      }
      setPending(null);
    }
  }, [pending, role, route, content, api]);

  // N1: 연결·동의한 어르신이 코스 홈에 있을 때, 이 계정에서 아직 답하지 않았으면 한 번(실행당 한 번만 확인)
  const asked = useRef(false);
  useEffect(() => {
    if (role !== 'parent' || !linked || !consented || route !== 'CourseHome' || pending || asked.current) {
      return;
    }
    asked.current = true;
    shouldPromptParent(deps).then(yes => {
      if (yes && navRef.isReady() && navRef.getCurrentRoute()?.name === 'CourseHome') {
        navRef.navigate('PushPermission');
      }
    });
  }, [role, linked, consented, route, pending, deps]);

  return null;
}
