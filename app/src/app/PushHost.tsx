import {useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {parsePushKind, type PushKind} from '../api/contract/push';
import {isQuietEventFailure} from '../api/contract/events';
import {getAppEnv} from '../lib/env';
import {navRef, useCurrentRouteName} from '../navigation/navRef';
import {pushChannelSpecs} from '../push/channels';
import {ensureChannels, readNotifyPermission} from '../push/notifyNative';
import {isParentKind, parentStepAfterOpen} from '../push/openRoute';
import {registerToken, retryPending, shouldPromptParent} from '../push/pushClient';
import {configurePush} from '../push/runtime';
import {pickTokenSource, type PushData, type PushTokenSource} from '../push/tokenSource';
import {handleChildPushOpen} from '../features/home/pushOpen';
import {useSession} from './session';

type Role = 'parent' | 'child' | null | 'loading';
const TAB_ROUTES = ['Album', 'Past']; // 자녀 탭 안 화면(getCurrentRoute 는 가장 안쪽 이름을 준다)
// 어르신 알림 탭이 끊지 않는 진행 중 화면(리뷰 L6)
const PARENT_BUSY_ROUTES = ['Connect', 'Consent', 'PushPermission', 'DeleteAccount', 'DeleteDone'];
const PENDING_TTL_MS = 10 * 60 * 1000;
type Pending = {data: PushData; kind: PushKind | null; stage: 'open' | 'step'; at: number; tag: string | null | undefined};
const isChildKind = (k: PushKind) => k === 'parent_connected' || k === 'parent_reconnected';
const tagOf = (api: {accountTag(): Promise<string | null>}) => api.accountTag().catch(() => null);

// 푸시 조립(AU-04): 채널 만들기 · 토큰 등록·갱신 · 어르신 N1 띄우기 · 알림 탭 라우팅(U1·AC-03) · push_opened.
// 화면을 그리지 않는다. 토큰 공급자는 API 모드로 고른다(fake 모드 = 가짜 토큰, real = Firebase(US-10) 전까지 없음).
export function PushHost({role, source: given}: {role: Role; source?: PushTokenSource}) {
  const {api, content, consented, done} = useSession();
  const courseDone = new Set(done).size >= 3; // 오늘 코스(3단계)를 다 마쳤나 — N1 은 도장 뒤(V1)
  const source = useMemo(() => given ?? pickTokenSource(getAppEnv().API_MODE), [given]);
  const deps = useMemo(() => configurePush(api, source), [api, source]);
  const route = useCurrentRouteName();
  const linked = content?.linked ?? false;

  useEffect(() => {
    ensureChannels(pushChannelSpecs());
  }, []);

  // 토큰 등록(권한이 있을 때만): 앱 시작·역할이 정해질 때·앞으로 돌아올 때·토큰 갱신 때. 등록은 멱등.
  // 리뷰 L4: 연결 전 어르신도 등록한다 — 서버가 no_profile 이어도 같은 토큰의 다른 계정 행을 지운다(0036, 해제 못 한 이전 계정 알림 차단).
  // 받기 동의(set_push_enabled)는 여기서 하지 않는다(어르신 N1·자녀 '알림 켜기'·토글을 눌렀을 때만, 리뷰 L2). 어르신 N1 미반영분만 재시도.
  const ready = role === 'child' || role === 'parent';
  useEffect(() => {
    if (!ready) {
      return;
    }
    const sync = async () => {
      if (role === 'parent') {
        await retryPending(deps);
      }
      if ((await readNotifyPermission()) === 'granted') {
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
  }, [ready, role, deps, source, linked]);

  // 알림 탭: 받은 data 를 잠시 두고, 그 역할의 화면이 준비되면 처리한다(꺼진 앱을 알림으로 연 경우 포함).
  // 리뷰 L5: 받을 때의 계정과 처리할 때의 계정이 다르면 버린다. 오래(10분) 처리 못 한 것도 버린다.
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => {
    const take = (data: PushData) => {
      const p: Pending = {data, kind: parsePushKind(data), stage: 'open', at: Date.now(), tag: undefined};
      setPending(p);
      tagOf(api).then(tag => setPending(cur => (cur && cur.at === p.at && cur.data === data ? {...cur, tag} : cur)));
    };
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
  }, [source, api]);

  useEffect(() => {
    if (!pending || role === 'loading' || !navRef.isReady() || pending.tag === undefined) {
      return;
    }
    if (Date.now() - pending.at > PENDING_TTL_MS) {
      setPending(null);
      return;
    }
    const {data, kind, stage} = pending;
    if (role === 'child') {
      if (!kind || !isChildKind(kind)) {
        setPending(null); // 자녀 기기에 어르신 종류가 오면 버린다(방어, 리뷰 L7)
        return;
      }
      // 연결 알림 → 앨범 탭(로그인·대기 전 화면에서는 이동하지 않는다: 대기 화면은 연결되면 스스로 넘어간다)
      const toTabs = !!route && TAB_ROUTES.includes(route);
      if (!toTabs && route !== 'Wait') {
        return;
      }
      let alive = true;
      tagOf(api).then(now => {
        if (!alive) {
          return;
        }
        setPending(null);
        if (now === pending.tag) {
          handleChildPushOpen(api, data, toTabs ? () => navRef.navigate('Tabs', {screen: 'Album'}) : () => {});
        }
      });
      return () => {
        alive = false;
      };
    }
    if (role !== 'parent' || !kind || !isParentKind(kind)) {
      setPending(null); // 역할 선택 화면·모르는 종류·다른 역할 알림은 버린다
      return;
    }
    if (stage === 'open') {
      // 리뷰 L6: 연결·동의·N1·지우기처럼 진행 중인 화면은 끊지 않는다(그 화면을 떠나 다른 화면이 되면 처리)
      if (!route || PARENT_BUSY_ROUTES.includes(route)) {
        return;
      }
      api
        .logEvent('push_opened', {push_kind: kind})
        .then(r => {
          if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
            console.warn(`[log_event] push_opened: ${r.reason}`);
          }
        })
        .catch(() => {});
      // [P3] 하나로 맞춘다. 단계는 P3 가 오늘 콘텐츠를 받은 뒤 위에 쌓는다
      navRef.reset({index: 0, routes: [{name: 'CourseHome'}]});
      setPending({...pending, stage: 'step'});
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

  // N1: 연결·동의한 어르신이 오늘 코스를 다 마치고(P7 도장 → '알겠어요') 코스 홈에 왔을 때, 이 계정에서 아직 답하지 않았으면 한 번
  // (실행당 한 번만 확인). V1(DECISIONS 11-19): 가치를 보기 전(첫 코스 직전)에 묻지 않는다. 링크 경로의 연결·동의 순서는 그대로
  const asked = useRef(false);
  useEffect(() => {
    if (role !== 'parent' || !linked || !consented || !courseDone || route !== 'CourseHome' || pending || asked.current) {
      return;
    }
    asked.current = true;
    shouldPromptParent(deps).then(yes => {
      if (yes && navRef.isReady() && navRef.getCurrentRoute()?.name === 'CourseHome') {
        navRef.navigate('PushPermission');
      }
    });
  }, [role, linked, consented, courseDone, route, pending, deps]);

  return null;
}
