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

/** 등록 하나를 '진행 중'으로 센다(pushClient.registerToken 이 감싼다) */
export function trackPushRegistration<T>(p: Promise<T>): Promise<T> {
  inflight.add(p);
  p.then(
    () => inflight.delete(p),
    () => inflight.delete(p),
  );
  return p;
}

/** 진행 중인 등록이 끝나기를 기다린다(없으면 바로). 시간을 넘기면 그대로 진행한다 — 그 뒤 끝난 등록의 서버 행은 다음 계정이 같은 토큰을 등록할 때 서버가 지운다(0036) */
export async function settlePushRegistrations(ms: number = SETTLE_MS): Promise<void> {
  if (inflight.size === 0) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([...inflight]),
    new Promise<void>(r => {
      timer = setTimeout(r, ms);
    }),
  ]);
  clearTimeout(timer);
}

/** 테스트용 */
export function setPushTokenStoreForTest(next: KeyValueStore | null) {
  store = next;
}
