// FCM 토큰 공급자(AU-04 후속 — Firebase 연결 준비). @react-native-firebase/messaging 이 **설치되기 전에도** 앱·테스트가 깨지지 않게
// 모듈을 try 블록 바로 안에서 require 한다(Metro 는 이 모양만 선택적 의존성으로 다룬다, lib/env.ts 와 같은 방식). 없으면 null.
// pickTokenSource('real') 가 FCM_WIRED 일 때 쓴다(DECISIONS 11-18 리뷰 M1 조건 = 앱 안 끄기 토글 P13 NotifyRows·C7 FamilyPushRow, 11-25 충족).
// 모듈러 API(v22+): getMessaging·getToken·onTokenRefresh·getInitialNotification·onNotificationOpenedApp·onMessage·setAutoInitEnabled.
import type {PushData, PushTokenSource} from './tokenSource';

type RemoteMessage = {data?: Record<string, unknown>} | null;
type Messaging = unknown;
type MessagingModule = {
  getMessaging(): Messaging;
  getToken(m: Messaging): Promise<string>;
  deleteToken(m: Messaging): Promise<void>;
  onTokenRefresh(m: Messaging, cb: (t: string) => void): () => void;
  getInitialNotification(m: Messaging): Promise<RemoteMessage>;
  onNotificationOpenedApp(m: Messaging, cb: (msg: RemoteMessage) => void): () => void;
  onMessage(m: Messaging, cb: (msg: RemoteMessage) => void): () => void;
  setAutoInitEnabled(m: Messaging, enabled: boolean): Promise<void>;
  setBackgroundMessageHandler?(m: Messaging, handler: (msg: RemoteMessage) => Promise<void>): void;
};

function requireMessaging(): MessagingModule | null {
  try {
    return require('@react-native-firebase/messaging');
  } catch {
    return null;
  }
}

/** 서버 메시지 data 는 {kind} 하나(0033·0038). 다른 키는 버린다(개인 정보가 실려 와도 앱이 쓰지 않게) */
export function dataOf(msg: RemoteMessage): PushData | null {
  const k = msg?.data?.kind;
  return typeof k === 'string' ? {kind: k} : null;
}

/** 설치된 모듈로 공급자를 만든다(테스트는 가짜 모듈을 넘긴다). 모듈이 없거나 Firebase 초기화가 실패하면 null */
export function createFcmTokenSourceFrom(mod: MessagingModule | null): PushTokenSource | null {
  if (!mod) {
    return null;
  }
  let m: Messaging;
  try {
    m = mod.getMessaging(); // google-services.json 이 없는 flavor 면 여기서 실패 → null(토큰 없음으로)
  } catch {
    return null;
  }
  const safeSub = (sub: () => () => void): (() => void) => {
    try {
      return sub();
    } catch {
      return () => {};
    }
  };
  return {
    kind: 'fcm',
    // 권한이 허용된 뒤에만 부른다(PushHost·pushClient 가 확인). 자동 초기화는 firebase.json 에서 끄고(설치 ID 를 미리 만들지 않음, QA-07)
    // 첫 토큰 요청 때 켠다.
    getToken: async () => {
      try {
        await mod.setAutoInitEnabled(m, true);
        return await mod.getToken(m);
      } catch {
        return null;
      }
    },
    // 로그아웃 정리 실패 때만(#262 QA-3 M1). 실패해도 조용히(로그아웃은 계속)
    deleteToken: async () => {
      try {
        await mod.deleteToken(m);
      } catch {}
    },
    onTokenRefresh: cb => safeSub(() => mod.onTokenRefresh(m, cb)),
    getInitialOpen: async () => {
      try {
        return dataOf(await mod.getInitialNotification(m));
      } catch {
        return null;
      }
    },
    onOpen: cb =>
      safeSub(() =>
        mod.onNotificationOpenedApp(m, msg => {
          const d = dataOf(msg);
          if (d) {
            cb(d);
          }
        }),
      ),
    onForeground: cb =>
      safeSub(() =>
        mod.onMessage(m, msg => {
          const d = dataOf(msg);
          if (d) {
            cb(d);
          }
        }),
      ),
  };
}

export function createFcmTokenSource(): PushTokenSource | null {
  return createFcmTokenSourceFrom(requireMessaging());
}

/**
 * 앱이 뒤에 있거나 꺼져 있을 때 온 메시지(#262 리뷰): RNFB 는 그때 머리 없는 작업 'ReactNativeFirebaseMessagingHeadlessTask' 를 띄우는데,
 * 그 작업은 메시징 모듈을 만들 때 등록된다. index.js 에서 앱보다 먼저 부른다(RNFB 안내). 할 일은 없다 — 알림은 OS 가 그리고
 * 탭은 getInitialNotification·onNotificationOpenedApp 이 받는다. 토큰을 요청하지 않으므로 설치 ID·토큰은 생기지 않는다(자동 초기화 끔).
 * 모듈이 없거나 Firebase 앱이 없는 빌드면 아무것도 하지 않고 false.
 */
export function registerBackgroundHandler(mod: MessagingModule | null = FCM_WIRED ? requireMessaging() : null): boolean {
  if (!mod?.setBackgroundMessageHandler) {
    return false;
  }
  try {
    mod.setBackgroundMessageHandler(mod.getMessaging(), async () => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * real 모드가 FCM 토큰을 쓴다(내부 테스트 N1, DECISIONS 2026-11-25 'FCM_WIRED 켬'). 켜는 조건이던 리뷰 M1(앱 안 끄기 토글 P13·C7)은 main 에 있다.
 * 남겨 두는 이유: 앱 쪽 FCM(토큰·머리 없는 작업)을 한 줄로 걷어 내는 스위치. **빌드 시간 상수라 바꾸면 새 빌드·스토어 배포가 필요**하다 —
 * 실발송 문제의 즉시 차단은 서버 쪽(Edge secrets `PUSH_DRY_RUN=1`, cron 중지, `push_enabled` 필터)이 맡는다(#262 QA-1 L4).
 * 토큰 요청은 알림이 허용된 상태이고 **받기 동의가 확인된 뒤에만**(N1 '알려 주세요'·자녀 '알림 켜기'·P13/C7 켬 성공, 또는 서버 my_push_settings true —
 * 대기열 38, DECISIONS 11-25 '동의 뒤에만 토큰'). Android 12 이하(알림 기본 허용)도 동의 전에는 getToken 0회.
 * google-services.json 이 없는 빌드는 createFcmTokenSource 가 null → 토큰 없음(지금과 같음).
 */
export const FCM_WIRED = true;
