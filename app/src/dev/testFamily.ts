// 개발자 메뉴: 테스트 가족 한 번에 만들기(staging·local 전용, production 번들 제외).
// 자녀 세션 → 가족·번호 → 자녀 세션 보관 → 이 기기 세션 내림 → 어르신 익명 연결(redeem 이 익명 로그인) → 어르신 세션 보관.
// 비밀번호는 코드·로그에 두지 않는다: 테스트 계정은 개발 빌드의 config.local.ts(gitignore)에서만 받는다. 없으면 보관된 자녀 세션.
// 번호는 결과·로그에 싣지 않는다.
import type {Api} from '../features/types';
import {isServerError} from '../features/types';
import type {KeyValueStore} from '../lib/localStamps';
import {createSessionSlots, type AuthLike} from './sessionSlots';

export type DevAuth = AuthLike & {
  signInWithPassword(c: {email: string; password: string}): Promise<{error: unknown}>;
};

// supabase-js auth 를 개발자 메뉴용으로 감싼다. _removeSession 은 비공개 API(서버 호출 없이 이 기기 세션만 지움):
// supabase-js 를 올릴 때 이름이 그대로인지 통합 테스트(__integration__/devMenu)가 확인한다
type SupabaseAuthLike = {
  getSession(): Promise<{data: {session: {access_token: string; refresh_token: string} | null}; error: unknown}>;
  setSession(t: {access_token: string; refresh_token: string}): Promise<{error: unknown}>;
  signInWithPassword(c: {email: string; password: string}): Promise<{error: unknown}>;
};
export function supabaseDevAuth(auth: SupabaseAuthLike): DevAuth {
  return {
    getSession: () => auth.getSession(),
    setSession: t => auth.setSession(t),
    signInWithPassword: c => auth.signInWithPassword(c),
    async clearLocal() {
      const remove = (auth as unknown as {_removeSession?: () => Promise<void>})._removeSession;
      if (!remove) {
        throw new Error('supabase auth _removeSession 없음');
      }
      await remove.call(auth);
    },
  };
}
export type TestFamilyResult = {ok: true} | {ok: false; reason: 'no_child_session' | 'redeem_failed'};

export async function createTestFamily(d: {
  api: Api;
  auth: DevAuth;
  store: KeyValueStore;
  creds?: {email: string; password: string};
}): Promise<TestFamilyResult> {
  const slots = createSessionSlots(d.auth, d.store);
  // 1. 자녀 세션
  if (d.creds) {
    const {error} = await d.auth.signInWithPassword(d.creds);
    if (error) {
      return {ok: false, reason: 'no_child_session'};
    }
  } else if ((await d.api.whoAmI()) !== 'child' && !(await slots.restore('child'))) {
    return {ok: false, reason: 'no_child_session'};
  }
  // 2. 가족(이미 있으면 그대로)·번호
  try {
    await d.api.createFamily();
  } catch (e) {
    if (!isServerError(e, 'already_has_profile')) {
      throw e;
    }
  }
  const code = await d.api.issueInviteCode();
  // 3. 자녀 세션 보관 후 내리고 어르신으로(redeem 이 익명 로그인)
  await slots.saveCurrent('child');
  await d.auth.clearLocal(); // 자녀 세션은 서버에서 살아 있어야 다시 꺼낼 수 있다
  const r = await d.api.redeemInviteCode(code);
  if (!r.ok) {
    return {ok: false, reason: 'redeem_failed'};
  }
  await slots.saveCurrent('parent');
  return {ok: true};
}
