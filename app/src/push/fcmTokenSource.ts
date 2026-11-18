// FCM 토큰 공급자(AU-04 후속 — Firebase 연결 준비). @react-native-firebase/messaging 이 **설치되기 전에도** 앱·테스트가 깨지지 않게
// 모듈을 try 블록 바로 안에서 require 한다(Metro 는 이 모양만 선택적 의존성으로 다룬다, lib/env.ts 와 같은 방식). 없으면 null.
// 아직 pickTokenSource 에 연결하지 않는다(DECISIONS 11-18 리뷰 M1: 앱 안 끄기 토글 P13·C7 이 main 에 들어온 뒤 FCM_WIRED 를 켬).
// 모듈러 API(v22+): getMessaging·getToken·onTokenRefresh·getInitialNotification·onNotificationOpenedApp·onMessage·setAutoInitEnabled.
import type {PushData, PushTokenSource} from './tokenSource';

type RemoteMessage = {data?: Record<string, unknown>} | null;
type Messaging = unknown;
type MessagingModule = {
  getMessaging(): Messaging;
  getToken(m: Messaging): Promise<string>;
  onTokenRefresh(m: Messaging, cb: (t: string) => void): () => void;
  getInitialNotification(m: Messaging): Promise<RemoteMessage>;
  onNotificationOpenedApp(m: Messaging, cb: (msg: RemoteMessage) => void): () => void;
  onMessage(m: Messaging, cb: (msg: RemoteMessage) => void): () => void;
  setAutoInitEnabled(m: Messaging, enabled: boolean): Promise<void>;
};

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
  let mod: MessagingModule | null;
  try {
    mod = require('@react-native-firebase/messaging');
  } catch {
    mod = null;
  }
  return createFcmTokenSourceFrom(mod);
}

/** M1 조건(앱 안 끄기 토글 main 반영) 전까지 false. 켜면 real 모드가 FCM 토큰을 쓴다 */
export const FCM_WIRED = false;
