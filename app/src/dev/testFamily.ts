// 개발자 메뉴: 테스트 가족 만들기·정리(staging·local 전용, production 번들 제외).
// 만들기: (지금 세션 보관) → 자녀 세션 → 가족·번호 → 자녀 세션 보관 → 이 기기 세션 내림 → 어르신 익명 연결 → 어르신 세션 보관.
// 정리(보안 리뷰 M3): 내가 만든 테스트 가족만 — 어르신(익명)을 기존 계정 지우기(delete_my_account)로, 자녀가 테스트 계정이면 자녀도
//   지워 가족까지 정리한다. 실제 개인(소셜) 자녀 계정은 지우지 않는다.
// 비밀번호는 코드·로그에 두지 않는다: 테스트 계정은 개발 빌드의 config.local.ts(gitignore, release 번들에서는 빈 모듈)에서만,
// 그리고 테스트 도메인 이메일만 받는다. 번호·토큰은 결과·로그에 싣지 않는다.
import type {Api} from '../features/types';
import {isServerError} from '../features/types';
import type {KeyValueStore} from '../lib/localStamps';
import {createSessionSlots, TEST_FAMILY_KEY, type AuthLike} from './sessionSlots';

export type DevAuth = AuthLike & {
  signInWithPassword(c: {email: string; password: string}): Promise<{error: unknown}>;
};

// supabase-js auth 를 개발자 메뉴용으로 감싼다. _removeSession 은 비공개 API(서버 호출 없이 이 기기 세션만 지움):
// 이름이 그대로인지 단위 테스트(devMenu.test)와 통합 테스트(__integration__/devMenu)가 확인한다
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

// 테스트 계정은 표식 도메인만(실제 사람 계정을 테스트 가족으로 쓰지 않게)
export const isTestEmail = (email: string) => /@([a-z0-9-]+\.)*(example\.(test|com|org)|[a-z0-9-]+\.test)$/i.test(email.trim());

export type TestFamilyResult = {ok: true} | {ok: false; reason: 'no_child_session' | 'not_test_account' | 'redeem_failed'};
type Deps = {api: Api; auth: DevAuth; store: KeyValueStore; creds?: {email: string; password: string}};

export async function createTestFamily(d: Deps): Promise<TestFamilyResult> {
  const slots = createSessionSlots(d.auth, d.store);
  if (d.creds && !isTestEmail(d.creds.email)) {
    return {ok: false, reason: 'not_test_account'};
  }
  // 0. 지금 세션은 버리지 않고 칸에 둔다(M2)
  const who = await d.api.whoAmI();
  await slots.keepCurrent(who);
  // 1. 자녀 세션
  if (d.creds) {
    await d.auth.clearLocal();
    const {error} = await d.auth.signInWithPassword(d.creds);
    if (error) {
      return {ok: false, reason: 'no_child_session'};
    }
  } else if (who !== 'child' && !(await slots.restore('child'))) {
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
  // 3. 자녀 세션 보관 후 이 기기에서만 내리고 어르신으로(redeem 이 익명 로그인)
  await slots.saveCurrent('child');
  await d.auth.clearLocal(); // 자녀 세션은 서버에서 살아 있어야 다시 꺼낼 수 있다
  const r = await d.api.redeemInviteCode(code);
  if (!r.ok) {
    return {ok: false, reason: 'redeem_failed'};
  }
  await slots.saveCurrent('parent');
  // 정리 대상 기록: 자녀가 테스트 계정일 때만 자녀까지 지운다
  await d.store.setItem(TEST_FAMILY_KEY, JSON.stringify({childIsTest: !!d.creds, at: Date.now()}));
  return {ok: true};
}

export type CleanupResult = {ok: true; parent: boolean; child: boolean} | {ok: false; reason: 'nothing_to_clean'};

export async function cleanupTestFamily(d: Omit<Deps, 'creds'>): Promise<CleanupResult> {
  const raw = await d.store.getItem(TEST_FAMILY_KEY);
  let mark: {childIsTest?: boolean} | null = null;
  try {
    mark = raw ? JSON.parse(raw) : null;
  } catch {
    mark = null;
  }
  if (!mark) {
    return {ok: false, reason: 'nothing_to_clean'};
  }
  const slots = createSessionSlots(d.auth, d.store);
  let parent = false;
  let child = false;
  // 어르신(익명) 먼저: 계정 지우기(scope parent)로 프로필·익명 인증 계정까지
  await d.auth.clearLocal();
  if ((await slots.restore('parent')) && (await d.api.whoAmI()) === 'parent') {
    await d.api.deleteMyAccount();
    parent = true;
  }
  // 자녀가 테스트 계정이면 자녀도(마지막 자녀면 가족까지 지워진다)
  if (mark.childIsTest) {
    await d.auth.clearLocal();
    if ((await slots.restore('child')) && (await d.api.whoAmI()) === 'child') {
      await d.api.deleteMyAccount();
      child = true;
    }
  }
  await slots.clearAll();
  await d.auth.clearLocal().catch(() => {});
  return {ok: true, parent, child};
}
