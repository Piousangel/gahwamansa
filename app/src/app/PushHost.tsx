import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {parsePushKind, type PushKind} from '../api/contract/push';
import {isQuietEventFailure} from '../api/contract/events';
import {getAppEnv} from '../lib/env';
import {navRef, useCurrentRouteName} from '../navigation/navRef';
import {pushChannelSpecs} from '../push/channels';
import {ensureChannels, readNotifyPermission} from '../push/notifyNative';
import {isParentKind, parentStepAfterOpen} from '../push/openRoute';
import {FIVE_STEP_ORDER, fiveStepsActive, fiveStepsOn} from '../features/course/fiveSteps';
import {parentPromptState, registerIfConsented, retryPending} from '../push/pushClient';
import {configurePush} from '../push/runtime';
import {N1Prompt} from '../push/N1Prompt';
import {pickTokenSource, type PushData, type PushTokenSource} from '../push/tokenSource';
import {handleChildPushOpen} from '../features/home/pushOpen';
import {useSession} from './session';

type Role = 'parent' | 'child' | null | 'loading';
const TAB_ROUTES = ['Album', 'Past']; // 자녀 탭 안 화면(getCurrentRoute 는 가장 안쪽 이름을 준다)
// 어르신 알림 탭이 끊지 않는 진행 중 화면(리뷰 L6)
const PARENT_BUSY_ROUTES = ['Connect', 'Consent', 'DeleteAccount', 'DeleteDone'];
const PENDING_TTL_MS = 10 * 60 * 1000;
type Pending = {data: PushData; kind: PushKind | null; stage: 'open' | 'step'; at: number; tag: string | null | undefined};
const isChildKind = (k: PushKind) => k === 'parent_connected' || k === 'parent_reconnected' || k === 'parent_first_answer';
const tagOf = (api: {accountTag(): Promise<string | null>}) => api.accountTag().catch(() => null);

// 푸시 조립(AU-04): 채널 만들기 · 토큰 등록·갱신 · 어르신 N1 띄우기 · 알림 탭 라우팅(U1·AC-03) · push_opened.
// 그리는 것은 N1(ds Dialog, P7 뒤 코스 홈 위) 하나뿐. 토큰 공급자는 API 모드로 고른다(fake 모드 = 가짜 토큰, real = FCM — google-services.json 없는 빌드는 토큰 없음).
export function PushHost({role, source: given}: {role: Role; source?: PushTokenSource}) {
  const {api, content} = useSession();
  const source = useMemo(() => given ?? pickTokenSource(getAppEnv().API_MODE), [given]);
  const deps = useMemo(() => configurePush(api, source), [api, source]);
  const [ask, setAsk] = useState(0); // N1 을 물을 차례(0 = 아님). P7 뒤 코스 홈에서 '물어야 함'을 확인하면 올린다
  const n1Open = ask > 0; // N1 이 떠 있는 동안 알림 탭은 미룬다(리뷰 L6)
  const route = useCurrentRouteName();
  const linked = content?.linked ?? false;

  useEffect(() => {
    ensureChannels(pushChannelSpecs());
  }, []);

  // 토큰 등록(권한이 있고 **받기 동의가 확인될 때만**, 대기열 38·0062): 앱 시작·역할이 정해질 때·앞으로 돌아올 때·토큰 갱신 때. 등록은 멱등.
  // 동의는 서버 my_push_settings 로 확인하고, 모르면(오프라인) 토큰을 요청하지 않는다 — 동의 전 getToken 0회(설치 ID·토큰 생성 없음).
  // (옛 리뷰 L4 '연결 전에도 등록해 같은 토큰의 이전 계정 행 정리'는 #262 로그아웃 정리(해제 실패·시간 초과 → deleteToken)가 대신한다)
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
        await registerIfConsented(deps);
      }
    };
    sync();
    const app = AppState.addEventListener('change', s => {
      if (s === 'active') {
        sync();
      }
    });
    // 토큰이 바뀌면 등록만 다시(받기 재시도는 하지 않음, #262 리뷰). 권한·받기 동의 확인은 그대로 — 동의 전이면 getToken 0회.
    // 구독 자체는 JS 이벤트 듣기뿐이라 토큰을 만들지 않는다(RNFB 27.1 onTokenRefresh = emitter.addListener)
    const refresh = source.onTokenRefresh(() => {
      readNotifyPermission()
        .then(p => (p === 'granted' ? registerIfConsented(deps) : undefined))
        .catch(() => {});
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
      // 리뷰 L6: 연결·동의·N1(떠 있는 동안)·지우기처럼 진행 중인 화면은 끊지 않는다(그 화면을 떠나 다른 화면이 되면 처리)
      if (!route || PARENT_BUSY_ROUTES.includes(route) || n1Open) {
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
      const step = parentStepAfterOpen(kind, content, fiveStepsActive(fiveStepsOn(), content) ? FIVE_STEP_ORDER : undefined);
      if (step) {
        navRef.navigate(step);
      }
      setPending(null);
    }
  }, [pending, role, route, content, api, n1Open]);

  // N1 을 묻는 때(이번 실행에서 코스 홈에 이렇게 들어왔을 때만):
  //   ① 연결 직후(H1, 오너 11-25): 번호 연결(P1c Connect)·답 보여 주기(P2 Consent)를 마치고 코스 홈에 처음 왔을 때 — 연결한 날 코스를 안 해도
  //      다음 날 09시 알림이 오게. 사용자가 방금 끝낸 행동의 연속이라 '진입 즉시 권한 묻기'가 아니다.
  //   ② P7 의 연속(리드 결정 ⓐ, #168): P7(CourseDone) → 코스 홈으로 돌아왔을 때. ①에서 뒤로(오늘은 넘김)를 고른 사람에게 다음 날 다시 묻는 자리.
  // 앱을 열 때·앞으로 돌아올 때(깨어남)는 묻지 않는다(토스 '진입 즉시 권한 묻기 금지'). 하루 한 번 이하는 pushClient 기억이 지킨다:
  //   답함(알려 주세요·안 받을게요) → 다시 묻지 않음, 뒤로(답 없이) → 오늘은 넘김(다음 날 P7 뒤에 다시) — 재촉하지 않는다.
  // V1(DECISIONS 11-19 '가치를 보기 전에 묻지 않는다')은 ①로 바뀐다(오너 결정 H1, PR 본문 결정).
  // PR #65 리뷰 L1: 알림 받기와 답 보여 주기는 별개 동의 — 답 보여 주기에 동의하지 않은 어르신에게도 묻는다.
  const prevRoute = useRef<string | undefined>(undefined);
  const [fromP7, setFromP7] = useState(0); // 묻는 자리(①·②)로 코스 홈에 들어온 횟수(이번 실행)
  const fromLink = useRef(false); // 이번 묻기가 ①(연결 직후)인가
  useEffect(() => {
    const prev = prevRoute.current;
    if ((prev === 'CourseDone' || prev === 'Connect' || prev === 'Consent') && route === 'CourseHome') {
      fromLink.current = prev !== 'CourseDone';
      setFromP7(n => n + 1);
    }
    prevRoute.current = route;
  }, [route]);
  const handledP7 = useRef(0);
  useEffect(() => {
    if (role !== 'parent' || !linked || fromP7 === handledP7.current || route !== 'CourseHome' || pending) {
      return;
    }
    handledP7.current = fromP7;
    // #284 QA-1 L1: ①(연결 직후)에서 안 읽은 응원이 있으면(같은 기기 두 번째 연결) P8 응원 대화상자가 같은 진입에 뜬다 →
    //   N1 은 이번에는 묻지 않고(넘김 기록도 없음) 다음 P7 뒤로 미룬다. 응원 확인을 못 하면(오프라인) 그대로 묻는다
    const cheersFirst = fromLink.current
      ? api
          .getMyCheers()
          .then(r => r.cheers.length > 0)
          .catch(() => false)
      : Promise.resolve(false);
    cheersFirst
      .then(busy => (busy ? 'skip' : parentPromptState(deps)))
      .then(state => {
        if (state === 'ask' && navRef.isReady() && navRef.getCurrentRoute()?.name === 'CourseHome') {
          setAsk(n => n + 1);
        }
      })
      .catch(() => {}); // 확인 못 함(오프라인): 이번에는 묻지 않는다(깨어남에 다시 묻지 않는 결정 — 다음 P7 뒤에)
  }, [role, linked, fromP7, route, pending, deps, api]);

  return ask > 0 ? <N1Prompt key={ask} onClose={() => setAsk(0)} /> : null;
}
