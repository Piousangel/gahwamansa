// 이 기기에 등록한 푸시 토큰(로그아웃 때 unregister_push_token 으로 해제하려고 보관). React·RN 을 모른다.
// 등록(pushClient.registerToken)이 성공한 토큰만 savePushToken 으로 둔다.
import {defaultStore, type KeyValueStore} from './kvStore';

const KEY = 'push_token_v1';
let store: KeyValueStore | null = null;
const s = () => (store ??= defaultStore());

export async function savePushToken(token: string): Promise<void> {
  await s().setItem(KEY, token);
}
export async function readPushToken(): Promise<string | null> {
  try {
    return await s().getItem(KEY);
  } catch {
    return null;
  }
}
export async function clearPushToken(): Promise<void> {
  await s().removeItem(KEY).catch(() => {});
}
// 진행 중인 등록(#262 리뷰): 로그아웃이 해제·지우기를 한 **뒤에** 앞서 시작한 등록이 끝나 토큰을 다시 등록·기억하면
// 로그아웃한 계정이 이 기기 알림을 계속 받는다. 로그아웃은 진행 중인 등록이 끝나기를(최대 SETTLE_MS) 기다린 뒤 기억을 읽는다.
const inflight = new Set<Promise<unknown>>();
export const SETTLE_MS = 5000;
export const DEVICE_CALL_MS = 3000;
let settleMs = SETTLE_MS;

// 로그아웃 차수(#262 QA-3 M1·QA-1 L1·L2): 로그아웃 정리를 시작할 때 올린다.
// - 그 전에 시작해 서버 등록까지 끝난 등록은 기억에 쓰지 않고 lateTokens 에 남긴다 → 정리가 함께 해제한다.
// - 로그아웃이 끝날 때까지(세션을 지울 때까지) 새로 시작하는 등록은 서버를 부르지 않는다(signingOut).
let generation = 0;
let signingOut = false;
const lateTokens = new Set<string>();
export function pushGeneration(): number {
  return generation;
}
export function pushSigningOut(): boolean {
  return signingOut;
}
/** 서버 등록은 됐지만 그사이 로그아웃 정리가 시작돼 기억하지 않은 토큰(정리가 해제한다) */
export function noteLateRegistration(token: string) {
  lateTokens.add(token);
}
/** 로그아웃이 세션까지 지운 뒤(또는 실패로 끝난 뒤) 부른다 — 새 등록을 다시 받는다 */
export function endPushSignOut() {
  signingOut = false;
}

/** 이 기기 푸시 토큰 손잡이(PushHost 의 토큰 공급자 — runtime.configurePush 가 넣는다). 로그아웃 정리가 쓴다 */
export type PushDevice = {getToken(): Promise<string | null>; deleteToken(): Promise<void>};
let device: PushDevice | null = null;
export function setPushDevice(next: PushDevice | null) {
  device = next;
}

/** 등록 하나를 '진행 중'으로 센다(pushClient.registerToken 이 감싼다) */
export function trackPushRegistration<T>(p: Promise<T>): Promise<T> {
  inflight.add(p);
  p.then(
    () => inflight.delete(p),
    () => inflight.delete(p),
  );
  return p;
}

function within<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<'timeout'>(r => {
      timer = setTimeout(() => r('timeout'), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** 진행 중인 등록이 끝나기를 기다린다(없으면 바로). 시간을 넘겼으면 true */
export async function settlePushRegistrations(ms: number = settleMs): Promise<boolean> {
  if (inflight.size === 0) {
    return false;
  }
  return (await within(Promise.allSettled([...inflight]), ms)) === 'timeout';
}

/**
 * 로그아웃 때 이 기기 토큰 정리(0032, #262 QA-3 M1). 세션을 지우기 **전에** 부른다(해제에 auth.uid 가 필요).
 * 1) 차수를 올리고 새 등록을 막는다(끝은 endPushSignOut) → 2) 진행 중인 등록을 기다린다(최대 SETTLE_MS — 끝난 등록은 기억 대신 lateTokens 로)
 * → 3) 해제할 토큰: lateTokens + 기억, 둘 다 없고 시간을 넘겼으면 기기 토큰 — 등록이 진행 중이던 경우만 읽는다(토큰을 새로 만들지 않게)
 * → 4) unregister → 5) 시간을 넘겼거나 해제가 실패했으면 기기 토큰 자체를 무효화(deleteToken): 서버에 남은 옛 행은 다음 발송 때
 * FCM 이 UNREGISTERED 로 답해 서버가 지운다(0036 classifyFcmError) → 6) 기억 지움. 어느 단계가 실패해도 로그아웃은 계속.
 * 반환: unregister 결과(true 성공 · false 실패 · null 해제할 토큰 없음)
 */
export async function releasePushTokenOnSignOut(unregister: (token: string) => Promise<boolean>): Promise<boolean | null> {
  signingOut = true;
  generation += 1;
  const timedOut = await settlePushRegistrations();
  const tokens = new Set<string>(lateTokens);
  lateTokens.clear();
  const remembered = await readPushToken();
  if (remembered) {
    tokens.add(remembered);
  }
  if (tokens.size === 0 && timedOut && device) {
    const t = await within(device.getToken().catch(() => null), DEVICE_CALL_MS);
    if (t && t !== 'timeout') {
      tokens.add(t);
    }
  }
  let released: boolean | null = null;
  for (const token of tokens) {
    const ok = (await within(unregister(token).catch(() => false), DEVICE_CALL_MS)) === true;
    released = (released ?? true) && ok;
  }
  if ((timedOut || released === false) && device) {
    await within(device.deleteToken().catch(() => {}), DEVICE_CALL_MS);
  }
  await clearPushToken();
  return released;
}

/** 테스트용: 로그아웃 기다림 시간(null 이면 원래대로)·로그아웃 상태 초기화 */
export function setSettleMsForTest(ms: number | null) {
  settleMs = ms ?? SETTLE_MS;
  signingOut = false;
  lateTokens.clear();
}

/** 테스트용 */
export function setPushTokenStoreForTest(next: KeyValueStore | null) {
  store = next;
}
