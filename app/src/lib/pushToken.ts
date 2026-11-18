// 이 기기에 등록한 푸시 토큰(로그아웃 때 unregister_push_token 으로 해제하려고 보관). React·RN 을 모른다.
// TODO(AU-04 푸시 클라이언트): 토큰을 등록(register_push_token)할 때 savePushToken 으로 여기에 둔다. 지금은 등록이 없어 비어 있다.
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
/** 테스트용 */
export function setPushTokenStoreForTest(next: KeyValueStore | null) {
  store = next;
}
