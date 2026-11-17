// 개발자 메뉴: 역할별 세션 보관(staging·local 전용, production 번들에 들어가지 않는다 — DevMenuHost 에서만 import).
// 한 기기에서 어르신(익명)·자녀(로그인) 세션을 각각 칸에 두고 한 번에 바꾼다. 토큰은 supabase 가 원래 두는 곳과 같은
// 앱 저장소(AsyncStorage)에만 두고 로그에 찍지 않는다.
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

const key = (r: DevRole) => `dev_menu_session_${r}_v1`;

function parse(raw: string | null): Tokens | null {
  if (!raw) {
    return null;
  }
  try {
    const o = JSON.parse(raw);
    return o && typeof o.access_token === 'string' && typeof o.refresh_token === 'string'
      ? {access_token: o.access_token, refresh_token: o.refresh_token}
      : null;
  } catch {
    return null;
  }
}

export function createSessionSlots(auth: AuthLike, store: KeyValueStore) {
  const saveCurrent = async (role: DevRole) => {
    const {data} = await auth.getSession();
    const s = data.session;
    if (s) {
      await store.setItem(key(role), JSON.stringify({access_token: s.access_token, refresh_token: s.refresh_token}));
    }
  };
  return {
    saveCurrent,
    /** from: 지금 이 기기의 역할(none 이면 보관 안 함). 다른 역할 칸에 세션이 있으면 그것으로, 없으면 빈 상태 */
    async switchTo(from: DevRole | 'none', to: DevRole): Promise<'restored' | 'empty'> {
      if (from !== 'none') {
        await saveCurrent(from);
      }
      await auth.clearLocal();
      const t = parse(await store.getItem(key(to)));
      if (!t) {
        return 'empty';
      }
      const {error} = await auth.setSession(t);
      if (error) {
        await store.removeItem(key(to)); // 만료 등: 칸을 비우고 빈 상태로
        return 'empty';
      }
      return 'restored';
    },
    async restore(role: DevRole): Promise<boolean> {
      const t = parse(await store.getItem(key(role)));
      return !!t && !(await auth.setSession(t)).error;
    },
  };
}
