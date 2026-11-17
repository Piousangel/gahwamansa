// 개발자 메뉴: 역할별 세션 보관(staging·local 전용, production 번들에 들어가지 않는다 — DevMenuHost 에서만 import).
// 한 기기에서 어르신(익명)·자녀(로그인) 세션을 각각 칸에 두고 한 번에 바꾼다.
// 저장(보안 리뷰 2026-11-18 M2): 앱 전용 저장소(AsyncStorage, 백업 꺼짐)에 토큰 쌍 + 보관 시각. 7일 지나면 버린다.
//   로그아웃·계정 지우기·처음으로(역할 초기화) 때 devGate.clearDevSessions 로 모두 지운다. 암호화 저장은 새 의존성
//   (androidx.security-crypto)이 필요해 보류(리드 보고). 토큰은 로그에 찍지 않는다.
import type {KeyValueStore} from '../lib/localStamps';

export type DevRole = 'parent' | 'child';
type Tokens = {access_token: string; refresh_token: string};
// clearLocal: 이 기기 세션만 내린다(서버 로그아웃 금지 — signOut 은 scope:'local' 이어도 서버에서 그 세션의 refresh 토큰을
// 무효로 만들어 보관한 세션을 되살릴 수 없다. 통합 테스트로 확인). 앱은 supabase auth 의 _removeSession 으로 맞춘다(supabaseDevAuth).
export type AuthLike = {
  getSession(): Promise<{data: {session: Tokens | null}; error: unknown}>;
  setSession(t: Tokens): Promise<{error: unknown}>;
  clearLocal(): Promise<void>;
};

export const SLOT_KEEP_MS = 7 * 86400e3;
export const slotKey = (r: DevRole) => `dev_menu_session_${r}_v1`;
export const TEST_FAMILY_KEY = 'dev_menu_test_family_v1';
export const ALL_DEV_KEYS = [slotKey('parent'), slotKey('child'), TEST_FAMILY_KEY];

function parse(raw: string | null, now: number): Tokens | null {
  if (!raw) {
    return null;
  }
  try {
    const o = JSON.parse(raw);
    const ok = o && typeof o.access_token === 'string' && typeof o.refresh_token === 'string' && typeof o.saved_at === 'number';
    return ok && now - o.saved_at < SLOT_KEEP_MS ? {access_token: o.access_token, refresh_token: o.refresh_token} : null;
  } catch {
    return null;
  }
}

export function createSessionSlots(auth: AuthLike, store: KeyValueStore, now: () => number = () => Date.now()) {
  const read = async (role: DevRole) => parse(await store.getItem(slotKey(role)), now());
  const saveCurrent = async (role: DevRole) => {
    const {data} = await auth.getSession();
    const s = data.session;
    if (s) {
      await store.setItem(slotKey(role), JSON.stringify({access_token: s.access_token, refresh_token: s.refresh_token, saved_at: now()}));
    }
  };
  // 역할을 모르는 지금 세션(연결 전 익명)은 버리지 않고 어르신 칸이 비어 있을 때 그 칸에 둔다(M2: 익명은 다시 로그인할 수 없다)
  const keepCurrent = async (who: DevRole | 'none') => {
    if (who !== 'none') {
      await saveCurrent(who);
    } else if (!(await read('parent'))) {
      await saveCurrent('parent');
    }
  };
  return {
    read,
    saveCurrent,
    keepCurrent,
    /** who: 지금 이 기기의 역할. 지금 세션을 보관한 뒤 다른 역할 칸의 세션으로(없으면 빈 상태) */
    async switchTo(who: DevRole | 'none', to: DevRole): Promise<'restored' | 'empty'> {
      await keepCurrent(who);
      await auth.clearLocal();
      const t = await read(to);
      if (!t) {
        await store.removeItem(slotKey(to)); // 만료·깨진 값 정리
        return 'empty';
      }
      const {error} = await auth.setSession(t);
      if (error) {
        await store.removeItem(slotKey(to)); // 서버가 거절(만료 등): 칸을 비우고 빈 상태로
        return 'empty';
      }
      return 'restored';
    },
    async restore(role: DevRole): Promise<boolean> {
      const t = await read(role);
      return !!t && !(await auth.setSession(t)).error;
    },
    async clearAll() {
      await Promise.all(ALL_DEV_KEYS.map(k => store.removeItem(k)));
    },
  };
}
