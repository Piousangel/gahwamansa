// 푸시 토큰 공급자(DECISIONS 11-18: 인터페이스 + fake 먼저, @react-native-firebase 는 US-10 뒤 별도 항목).
// 화면·브리지는 이 인터페이스만 쓴다. Firebase 를 붙일 때 createFcmTokenSource 하나만 더하고 pickTokenSource 에서 고른다.
// React 를 모른다.

/** 알림 data(서버 0033·0038: {kind} 하나). 해석은 contract/push.parsePushKind */
export type PushData = unknown;

export interface PushTokenSource {
  /** none: 토큰 없음(Firebase 전 real 빌드) · fake: 개발·테스트 · fcm: 실제(US-10 뒤) */
  readonly kind: 'none' | 'fake' | 'fcm';
  /** 이 기기 토큰. 없거나 권한이 없으면 null */
  getToken(): Promise<string | null>;
  /** 토큰이 바뀌면(FCM onTokenRefresh) 다시 등록한다. 반환 = 구독 해제 */
  onTokenRefresh(cb: (token: string) => void): () => void;
  /** 꺼진 앱을 알림을 눌러 열었을 때의 data(한 번만 돌려준다). 없으면 null */
  getInitialOpen(): Promise<PushData | null>;
  /** 실행 중(백그라운드)에 알림을 눌렀을 때 */
  onOpen(cb: (data: PushData) => void): () => void;
  /** 앱이 앞에 있을 때 온 알림(FCM 은 이때 알림을 그리지 않는다) */
  onForeground(cb: (data: PushData) => void): () => void;
}

const noop = () => {};

/** Firebase 전 real 빌드: 토큰이 없으니 등록하지 않는다(가짜 토큰을 실서버에 올리지 않음) */
export const nullTokenSource: PushTokenSource = {
  kind: 'none',
  getToken: async () => null,
  onTokenRefresh: () => noop,
  getInitialOpen: async () => null,
  onOpen: () => noop,
  onForeground: () => noop,
};

export type FakeTokenSource = PushTokenSource & {
  /** 테스트·개발: 알림 탭 흉내 */
  emitOpen(data: PushData): void;
  emitForeground(data: PushData): void;
  /** 토큰 갱신 흉내 */
  refresh(token: string): void;
  setInitialOpen(data: PushData | null): void;
};

// 서버 형식(0032: 20자 이상, [A-Za-z0-9_:-])에 맞는 고정 값. fake API 모드에서만 쓰여 실서버에 가지 않는다.
export const FAKE_PUSH_TOKEN = 'fake_push_token_local_device_0001';

export function createFakeTokenSource(token: string | null = FAKE_PUSH_TOKEN): FakeTokenSource {
  let current = token;
  let initial: PushData | null = null;
  const refreshers = new Set<(t: string) => void>();
  const openers = new Set<(d: PushData) => void>();
  const fores = new Set<(d: PushData) => void>();
  const sub = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  };
  return {
    kind: 'fake',
    getToken: async () => current,
    onTokenRefresh: cb => sub(refreshers, cb),
    getInitialOpen: async () => {
      const d = initial;
      initial = null;
      return d;
    },
    onOpen: cb => sub(openers, cb),
    onForeground: cb => sub(fores, cb),
    emitOpen: d => openers.forEach(f => f(d)),
    emitForeground: d => fores.forEach(f => f(d)),
    refresh: t => {
      current = t;
      refreshers.forEach(f => f(t));
    },
    setInitialOpen: d => {
      initial = d;
    },
  };
}

/** API 모드로 고른다: fake 모드 = 가짜 토큰(화면·흐름 확인), real 모드 = Firebase 전까지 토큰 없음 */
export function pickTokenSource(apiMode: 'fake' | 'real'): PushTokenSource {
  return override ?? (apiMode === 'fake' ? createFakeTokenSource() : nullTokenSource);
}

let override: PushTokenSource | null = null;
/** 테스트용: 앱 전체가 이 공급자를 쓰게 한다(null 이면 원래대로) */
export function setTokenSourceForTest(next: PushTokenSource | null) {
  override = next;
}
