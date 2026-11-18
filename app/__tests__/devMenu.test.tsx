// staging 전용 개발자 메뉴: 진입 관문(production 불가)·번들 제외(Metro)·역할별 세션·테스트 가족·초기화
import React from 'react';
import {Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {isDevMenuAllowed, DevMenuContext, useVersionTaps, VERSION_TAPS, clearDevSessions, registerDevSessionCleaner} from '../src/dev/devGate';
import {createSessionSlots, SLOT_KEEP_MS} from '../src/dev/sessionSlots';
import {cleanupTestFamily, createTestFamily, isTestEmail} from '../src/dev/testFamily';
import {ServerError} from '../src/features/types';
import {memoryStore} from '../src/lib/localStamps';
import {createFakeApi} from '../src/features/fakeApi';

declare const __dirname: string;
const path: {join(...p: string[]): string} = require('path');
const {bundleAppEnv, devMenuRedirect, releaseBundleEnv} = require('../metroDevMenu');

describe('진입 관문', () => {
  test('production 은 어떤 경우에도 불가, staging 은 가능, local 은 개발 빌드에서만', () => {
    expect(isDevMenuAllowed('production', true)).toBe(false);
    expect(isDevMenuAllowed('production', false)).toBe(false);
    expect(isDevMenuAllowed('staging', false)).toBe(true);
    expect(isDevMenuAllowed('local', true)).toBe(true);
    expect(isDevMenuAllowed('local', false)).toBe(false);
  });

  function Probe({allowed}: {allowed: boolean}) {
    const onPress = useVersionTaps(allowed);
    return <Text onPress={onPress}>버전 1.0.0</Text>;
  }
  test(`버전 줄 ${VERSION_TAPS}번 탭에 열림(6번으로는 안 열림), 허용 안 되면 탭 처리 자체가 없다`, () => {
    const open = jest.fn();
    const {rerender} = render(
      <DevMenuContext.Provider value={{open}}>
        <Probe allowed />
      </DevMenuContext.Provider>,
    );
    for (let i = 0; i < VERSION_TAPS - 1; i++) {
      fireEvent.press(screen.getByText('버전 1.0.0'));
    }
    expect(open).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('버전 1.0.0'));
    expect(open).toHaveBeenCalledTimes(1);
    rerender(
      <DevMenuContext.Provider value={{open}}>
        <Probe allowed={false} />
      </DevMenuContext.Provider>,
    );
    expect(screen.getByText('버전 1.0.0').props.onPress).toBeUndefined();
  });
});

describe('R1: 출시 판정은 Gradle 전용 Metro 설정에서만', () => {
  test('개발 서버 설정(metro.config.js)은 대역을 걸지 않고, release 설정(metro.release.config.js)만 건다', () => {
    const fs = require('fs');
    const dev: string = fs.readFileSync(path.join(__dirname, '../metro.config.js'), 'utf8');
    const rel: string = fs.readFileSync(path.join(__dirname, '../metro.release.config.js'), 'utf8');
    expect(dev).not.toMatch(/devMenuRedirect|metroDevMenu/);
    expect(rel).toMatch(/releaseBundleEnv/);
    const gradle: string = fs.readFileSync(path.join(__dirname, '../android/app/build.gradle'), 'utf8');
    expect(gradle).toMatch(/bundleConfig\s*=\s*file\("\.\.\/\.\.\/metro\.release\.config\.js"\)/);
  });
  test('release 설정은 env.generated.ts 가 없거나 release 값이 아니면 번들을 멈춘다(fail-closed)', () => {
    const missing = () => {
      throw new Error('ENOENT');
    };
    expect(() => releaseBundleEnv('/x', missing)).toThrow(/env\.generated/);
    expect(() => releaseBundleEnv('/x', () => 'export default {\n  "APP_ENV": "staging",\n  "BUILD_TYPE": "debug"\n};')).toThrow(/release/);
    expect(releaseBundleEnv('/x', () => 'export default {\n  "APP_ENV": "production",\n  "BUILD_TYPE": "release"\n};')).toEqual({appEnv: 'production', buildType: 'release'});
  });
});

describe('번들 제외(Metro)', () => {
  const appDir = path.join(__dirname, '..');
  const impl = path.join(appDir, 'src/dev/DevMenuHost.tsx');
  const stub = path.join(appDir, 'src/dev/DevMenuHost.stub.tsx');
  const local = path.join(appDir, 'src/lib/config.local.ts');
  const empty = path.join(appDir, 'src/lib/config.local.empty.ts');
  const B = (appEnv: string, buildType: string) => ({appEnv, buildType});

  test('메뉴 구현은 staging·local 에만, 그 밖(production·알 수 없음)은 빈 대역(fail-closed)', () => {
    expect(devMenuRedirect(impl, B('production', 'release'), appDir)).toBe(stub);
    expect(devMenuRedirect(impl, B('production', 'debug'), appDir)).toBe(stub);
    expect(devMenuRedirect(impl, B('unknown', 'unknown'), appDir)).toBe(stub);
    expect(devMenuRedirect(impl, B('staging', 'release'), appDir)).toBeNull();
    expect(devMenuRedirect(impl, B('staging', 'debug'), appDir)).toBeNull();
    expect(devMenuRedirect(path.join(appDir, 'src/app/AppRoot.tsx'), B('production', 'release'), appDir)).toBeNull();
  });
  test('l2-appinfo 리뷰 L7: 공개 전 배경 음악(RELEASED=false)은 production·불명 번들에서 음원 없는 대역으로, 공개 뒤(true)나 staging 은 그대로', () => {
    const bgm = path.join(appDir, 'src/lib/bgmAsset.ts');
    const bgmStub = path.join(appDir, 'src/lib/bgmAsset.stub.ts');
    const off = () => 'const RELEASED = false;';
    const on = () => 'const RELEASED = true; // 확인됨';
    expect(devMenuRedirect(bgm, B('production', 'release'), appDir, off)).toBe(bgmStub);
    expect(devMenuRedirect(bgm, B('unknown', 'unknown'), appDir, off)).toBe(bgmStub);
    expect(devMenuRedirect(bgm, B('production', 'release'), appDir, on)).toBeNull();
    expect(devMenuRedirect(bgm, B('staging', 'release'), appDir, off)).toBeNull(); // 개발자 메뉴 미리 듣기용
    expect(devMenuRedirect(bgm, B('production', 'release'), appDir)).toBe(bgmStub); // 실제 파일은 지금 공개 전
    // 대역은 같은 API 를 내보낸다(require 없음)
    const stubSrc: string = require('fs').readFileSync(bgmStub, 'utf8');
    expect(stubSrc).not.toMatch(/require\(/);
    for (const name of ['bgmAsset', 'setBgmPreview', 'bgmPreview', 'setBgmAssetForTest']) {
      expect(stubSrc).toMatch(new RegExp(`export function ${name}\\b`));
    }
  });
  test('H1: config.local(개발용 값·테스트 계정)은 release 번들·환경 불명이면 빈 모듈로', () => {
    expect(devMenuRedirect(local, B('staging', 'release'), appDir)).toBe(empty);
    expect(devMenuRedirect(local, B('production', 'release'), appDir)).toBe(empty);
    expect(devMenuRedirect(local, B('unknown', 'unknown'), appDir)).toBe(empty);
    expect(devMenuRedirect(local, B('staging', 'debug'), appDir)).toBeNull(); // 개발 빌드는 로컬 서버 설정이 필요
  });
  test('M1: 번들 환경은 Gradle 이 쓴 env.generated.ts 만 믿는다(환경 변수 무시, 없거나 깨지면 unknown)', () => {
    const read = (s: string | null) =>
      bundleAppEnv('/x', () => {
        if (s === null) {
          throw new Error('ENOENT');
        }
        return s;
      });
    expect(read('export default {\n  "APP_ENV": "production",\n  "BUILD_TYPE": "release"\n};')).toEqual(B('production', 'release'));
    expect(read('export default {\n  "APP_ENV": "staging",\n  "BUILD_TYPE": "debug"\n};')).toEqual(B('staging', 'debug'));
    expect(read('export default {\n  "APP_ENV": "staging"\n};')).toEqual(B('staging', 'unknown')); // 옛 파일: release 로 본다(아래)
    expect(read('export default {\n  "APP_ENV": "weird"\n};').appEnv).toBe('unknown');
    expect(read(null)).toEqual(B('unknown', 'unknown'));
    expect(devMenuRedirect(local, B('staging', 'unknown'), appDir)).toBe(empty); // 빌드 종류를 모르면 빼는 쪽
    const env = (globalThis as unknown as {process: {env: Record<string, string | undefined>}}).process.env;
    env.BUMOJASIK_BUNDLE_APP_ENV = 'staging'; // 셸에 남은 옛 덮어쓰기 변수는 무시한다
    try {
      expect(read(null)).toEqual(B('unknown', 'unknown'));
    } finally {
      delete env.BUMOJASIK_BUNDLE_APP_ENV;
    }
  });
});

// supabase auth 흉내: 세션은 토큰 쌍만
function fakeAuth(initial: {access_token: string; refresh_token: string} | null) {
  let session = initial;
  return {
    calls: [] as string[],
    get current() {
      return session;
    },
    async getSession() {
      return {data: {session}, error: null};
    },
    async setSession(t: {access_token: string; refresh_token: string}) {
      this.calls.push(`set:${t.access_token}`);
      session = t;
      return {error: null};
    },
    async clearLocal() {
      this.calls.push('clearLocal');
      session = null;
    },
    async signInWithPassword(c: {email: string; password: string}) {
      this.calls.push(`password:${c.email}`);
      session = {access_token: 'child-a', refresh_token: 'child-r'};
      return {error: null};
    },
    async currentUser() {
      return session ? USERS[session.access_token] ?? {id: `u-${session.access_token}`, email: null} : null;
    },
  };
}
const USERS: Record<string, {id: string; email: string | null}> = {
  'child-a': {id: 'u-child', email: 'kid@example.test'},
  'c-a': {id: 'u-child', email: 'kid@example.test'},
  'p-a': {id: 'u-parent', email: null},
  'parent-a': {id: 'u-parent', email: null},
  'social-a': {id: 'u-social', email: 'me@gmail.com'},
  'anon2-a': {id: 'u-anon2', email: null},
};
const MARK = (o: object) => JSON.stringify({parentUserId: 'u-parent', childUserId: 'u-child', childIsTest: true, at: Date.now(), ...o});
const SLOT = (t: string) => JSON.stringify({access_token: t, refresh_token: `${t}-r`, saved_at: Date.now()});

describe('역할별 세션 보관·전환', () => {
  test('지금 세션을 그 역할 칸에 두고, 다른 역할 칸의 세션으로 바꾼다(없으면 빈 상태)', async () => {
    const auth = fakeAuth({access_token: 'child-a', refresh_token: 'child-r'});
    const store = memoryStore();
    const slots = createSessionSlots(auth, store);
    expect(await slots.switchTo('child', 'parent')).toBe('empty');
    expect(auth.current).toBeNull();
    await auth.setSession({access_token: 'parent-a', refresh_token: 'parent-r'});
    expect(await slots.switchTo('parent', 'child')).toBe('restored');
    expect(auth.current).toEqual({access_token: 'child-a', refresh_token: 'child-r'});
    expect(await slots.switchTo('child', 'parent')).toBe('restored');
    expect(auth.current).toEqual({access_token: 'parent-a', refresh_token: 'parent-r'});
  });
  test('저장 값이 깨졌으면 복원하지 않는다', async () => {
    const store = memoryStore();
    await store.setItem('dev_menu_session_parent_v1', '{oops');
    const slots = createSessionSlots(fakeAuth(null), store);
    expect(await slots.switchTo('none', 'parent')).toBe('empty');
  });
});

describe('보안 리뷰 반영: 보관 세션(M2)·분기(L4)', () => {
  test('M2: 역할을 모르는 지금 세션(연결 전 익명)은 버리지 않고 비어 있는 어르신 칸에 둔다', async () => {
    const auth = fakeAuth({access_token: 'anon-a', refresh_token: 'anon-r'});
    const store = memoryStore();
    await createSessionSlots(auth, store).switchTo('none', 'child');
    expect(await store.getItem('dev_menu_session_parent_v1')).toContain('anon-a');
  });
  test('M2: 7일 지난 칸은 쓰지 않고 지운다, 모두 지우기', async () => {
    const auth = fakeAuth({access_token: 'c-a', refresh_token: 'c-r'});
    const store = memoryStore();
    let now = 1_000_000;
    const slots = createSessionSlots(auth, store, () => now);
    await slots.saveCurrent('child');
    now += SLOT_KEEP_MS + 1;
    expect(await slots.switchTo('none', 'child')).toBe('empty');
    expect(await store.getItem('dev_menu_session_child_v1')).toBeNull();
    await slots.saveCurrent('parent');
    await slots.clearAll();
    expect(await store.getItem('dev_menu_session_parent_v1')).toBeNull();
  });
  test('L4: 서버가 보관 세션을 거절하면(setSession 오류) 칸을 비우고 빈 상태', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    await store.setItem('dev_menu_session_child_v1', JSON.stringify({access_token: 'x', refresh_token: 'y', saved_at: Date.now()}));
    (auth as unknown as {setSession: () => Promise<{error: unknown}>}).setSession = async () => ({error: new Error('expired')});
    expect(await createSessionSlots(auth, store).switchTo('none', 'child')).toBe('empty');
    expect(await store.getItem('dev_menu_session_child_v1')).toBeNull();
  });
  test('M2: 로그아웃·계정 지우기·처음으로 때 devGate 정리 훅이 보관 세션을 지운다(등록 없으면 아무 일 없음)', async () => {
    await expect(clearDevSessions()).resolves.toBeUndefined();
    const fn = jest.fn(async () => {});
    registerDevSessionCleaner(fn);
    await clearDevSessions();
    expect(fn).toHaveBeenCalledTimes(1);
    registerDevSessionCleaner(null);
  });
  test('M2: supabase auth 비공개 _removeSession 이 아직 있다(이름이 바뀌면 여기서 실패)', () => {
    const {GoTrueClient} = require('@supabase/auth-js');
    expect(typeof GoTrueClient.prototype._removeSession).toBe('function');
  });
  test('L4: 4초가 지나면 탭 수를 처음부터 센다', () => {
    jest.useFakeTimers();
    try {
      const open = jest.fn();
      function P() {
        const onPress = useVersionTaps(true);
        return <Text onPress={onPress}>v</Text>;
      }
      render(
        <DevMenuContext.Provider value={{open}}>
          <P />
        </DevMenuContext.Provider>,
      );
      for (let i = 0; i < VERSION_TAPS - 1; i++) {
        fireEvent.press(screen.getByText('v'));
      }
      jest.advanceTimersByTime(4001);
      fireEvent.press(screen.getByText('v'));
      expect(open).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('테스트 가족: 테스트 도메인·분기·정리(M3)', () => {
  test('테스트 도메인 이메일만 받는다', async () => {
    expect(isTestEmail('kid@example.test')).toBe(true);
    expect(isTestEmail('a@qa.test')).toBe(true);
    expect(isTestEmail('real.person@gmail.com')).toBe(false);
    const r = await createTestFamily({api: createFakeApi(), auth: fakeAuth(null), store: memoryStore(), creds: {email: 'me@gmail.com', password: 'p'}});
    expect(r).toEqual({ok: false, reason: 'not_test_account'});
  });
  test('가족이 이미 있으면(already_has_profile) 그대로 이어 가고, 연결 실패는 redeem_failed', async () => {
    const api = createFakeApi();
    jest.spyOn(api, 'createFamily').mockRejectedValue(new ServerError('create_family', 'already_has_profile', 'P0001'));
    jest.spyOn(api, 'redeemInviteCode').mockResolvedValue({ok: false, reason: 'expired'});
    const r = await createTestFamily({api, auth: fakeAuth(null), store: memoryStore(), creds: {email: 'kid@example.test', password: 'p'}});
    expect(r).toEqual({ok: false, reason: 'redeem_failed'});
  });
  test('정리: 만든 기록이 없으면 아무것도 지우지 않는다', async () => {
    const api = createFakeApi();
    const del = jest.spyOn(api, 'deleteMyAccount');
    expect(await cleanupTestFamily({api, auth: fakeAuth(null), store: memoryStore()})).toEqual({ok: false, reason: 'nothing_to_clean'});
    expect(del).not.toHaveBeenCalled();
  });
  test('정리: 어르신(익명) → 테스트 자녀 순서로 계정 지우기, 보관 칸·기록도 지운다', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    const now = Date.now();
    await store.setItem('dev_menu_session_parent_v1', JSON.stringify({access_token: 'p-a', refresh_token: 'p-r', saved_at: now}));
    await store.setItem('dev_menu_session_child_v1', JSON.stringify({access_token: 'c-a', refresh_token: 'c-r', saved_at: now}));
    await store.setItem('dev_menu_test_family_v1', MARK({}));
    const api = createFakeApi();
    jest.spyOn(api, 'whoAmI').mockImplementation(async () => (auth.current?.access_token === 'p-a' ? 'parent' : 'child'));
    const seen: string[] = [];
    jest.spyOn(api, 'deleteMyAccount').mockImplementation(async () => {
      seen.push(auth.current!.access_token);
      return {scope: 'family'};
    });
    expect(await cleanupTestFamily({api, auth, store})).toEqual({ok: true, parent: true, child: true});
    expect(seen).toEqual(['p-a', 'c-a']);
    expect(await store.getItem('dev_menu_test_family_v1')).toBeNull();
    expect(await store.getItem('dev_menu_session_child_v1')).toBeNull();
  });
  test('정리: 자녀가 실제 개인(소셜) 계정이면 자녀는 지우지 않는다', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    await store.setItem('dev_menu_session_parent_v1', JSON.stringify({access_token: 'p-a', refresh_token: 'p-r', saved_at: Date.now()}));
    await store.setItem('dev_menu_test_family_v1', MARK({childIsTest: false}));
    const api = createFakeApi();
    jest.spyOn(api, 'whoAmI').mockResolvedValue('parent');
    const del = jest.spyOn(api, 'deleteMyAccount').mockResolvedValue({scope: 'parent'});
    expect(await cleanupTestFamily({api, auth, store})).toEqual({ok: true, parent: true, child: false});
    expect(del).toHaveBeenCalledTimes(1);
  });

  test('R2: 칸이 바뀌어 다른 사람 세션이 들어 있으면(만들 때 user id 와 다름) 지우지 않는다', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    await store.setItem('dev_menu_session_parent_v1', SLOT('anon2-a')); // 실제로 연결한 다른 익명 어르신
    await store.setItem('dev_menu_session_child_v1', SLOT('social-a')); // 본인 소셜 계정
    await store.setItem('dev_menu_test_family_v1', MARK({}));
    const api = createFakeApi();
    jest.spyOn(api, 'whoAmI').mockImplementation(async () => (auth.current?.access_token === 'anon2-a' ? 'parent' : 'child'));
    const del = jest.spyOn(api, 'deleteMyAccount');
    expect(await cleanupTestFamily({api, auth, store})).toEqual({ok: true, parent: false, child: false});
    expect(del).not.toHaveBeenCalled();
    // 재확인 S1: 지우지 않은 칸은 그대로 남는다(표시만 정리)
    expect(await store.getItem('dev_menu_session_child_v1')).toContain('social-a');
    expect(await store.getItem('dev_menu_session_parent_v1')).toContain('anon2-a');
    expect(await store.getItem('dev_menu_test_family_v1')).toBeNull();
  });

  test('R2: user id 가 같아도 자녀 이메일이 테스트 도메인이 아니면 지우지 않는다', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    await store.setItem('dev_menu_session_child_v1', SLOT('social-a'));
    await store.setItem('dev_menu_test_family_v1', MARK({childUserId: 'u-social'}));
    const api = createFakeApi();
    jest.spyOn(api, 'whoAmI').mockResolvedValue('child');
    const del = jest.spyOn(api, 'deleteMyAccount');
    expect(await cleanupTestFamily({api, auth, store})).toMatchObject({ok: true, child: false});
    expect(del).not.toHaveBeenCalled();
  });

  test('R2: 정리 표시도 7일 지나면 쓰지 않는다', async () => {
    const store = memoryStore();
    await store.setItem('dev_menu_test_family_v1', MARK({at: Date.now() - SLOT_KEEP_MS - 1}));
    expect(await cleanupTestFamily({api: createFakeApi(), auth: fakeAuth(null), store})).toEqual({ok: false, reason: 'nothing_to_clean'});
    expect(await store.getItem('dev_menu_test_family_v1')).toBeNull();
  });

  test('R2: 정리 전에 지금 세션을 먼저 보관한다(버리지 않음)', async () => {
    const auth = fakeAuth({access_token: 'social-a', refresh_token: 'social-r'});
    const store = memoryStore();
    await store.setItem('dev_menu_test_family_v1', MARK({}));
    const api = createFakeApi();
    jest.spyOn(api, 'whoAmI').mockResolvedValue('child');
    await cleanupTestFamily({api, auth, store});
    // 정리가 끝나면 칸은 비워지지만, 지금 세션(소셜)은 지워지지 않고 다시 이 기기에 둔다
    expect(auth.current?.access_token).toBe('social-a');
  });

  test('R2: 만들 때 어르신·자녀 user id 와 자녀 이메일을 기록한다', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    const api = createFakeApi();
    const redeem = api.redeemInviteCode.bind(api);
    jest.spyOn(api, 'redeemInviteCode').mockImplementation(async c => {
      await auth.setSession({access_token: 'parent-a', refresh_token: 'parent-r'}); // redeem 이 익명 로그인
      return redeem(c);
    });
    await createTestFamily({api, auth, store, creds: {email: 'kid@example.test', password: 'p'}});
    expect(JSON.parse((await store.getItem('dev_menu_test_family_v1'))!)).toMatchObject({parentUserId: 'u-parent', childUserId: 'u-child', childIsTest: true});
  });

  test('낮음: 어르신 칸이 차 있으면 지금 익명 세션은 따로 둔 칸(anon)에 보관한다', async () => {
    const auth = fakeAuth({access_token: 'anon2-a', refresh_token: 'anon2-r'});
    const store = memoryStore();
    await store.setItem('dev_menu_session_parent_v1', SLOT('p-a'));
    await createSessionSlots(auth, store).switchTo('none', 'child');
    expect(await store.getItem('dev_menu_session_parent_v1')).toContain('p-a');
    expect(await store.getItem('dev_menu_session_anon_v1')).toContain('anon2-a');
  });
});

describe('테스트 가족 한 번에 만들기', () => {
  test('자녀(테스트 계정) → 가족·번호 → 자녀 세션 보관 → 어르신 익명 연결 → 어르신 세션 보관, 번호는 결과에 싣지 않는다', async () => {
    const auth = fakeAuth(null);
    const store = memoryStore();
    const api = createFakeApi();
    const order: string[] = [];
    jest.spyOn(api, 'createFamily').mockImplementation(async () => {
      order.push('createFamily');
      return {family_id: 'f', profile_id: 'c'};
    });
    jest.spyOn(api, 'issueInviteCode').mockImplementation(async () => {
      order.push('issue');
      return '123456';
    });
    const redeem = jest.spyOn(api, 'redeemInviteCode');
    const r = await createTestFamily({api, auth, store, creds: {email: 'kid@example.test', password: 'pw'}});
    expect(r).toEqual({ok: true});
    expect(auth.calls.slice(0, 2)).toEqual(['clearLocal', 'password:kid@example.test']);
    expect(order).toEqual(['createFamily', 'issue']);
    expect(redeem).toHaveBeenCalledWith('123456');
    expect(auth.calls).toContain('clearLocal'); // 자녀 세션을 이 기기에서만 내린 뒤 어르신으로(서버 로그아웃 없음)
    expect(JSON.stringify(r)).not.toContain('123456');
    expect(await store.getItem('dev_menu_session_child_v1')).toContain('child-a');
  });
  test('테스트 계정도 저장된 자녀 세션도 없으면 하지 않는다', async () => {
    const r = await createTestFamily({api: createFakeApi(), auth: fakeAuth(null), store: memoryStore()});
    expect(r).toEqual({ok: false, reason: 'no_child_session'});
  });
});

describe('메뉴 화면(fake 모드)', () => {
  test('버전 7번 → 환경 표시 → 어르신으로 전환하면 앱을 처음부터(역할 지정)', async () => {
    const {App} = require('../testUtils/devApp');
    render(<App />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '설정'}));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '앱 정보, 버전 1.0.0'}));
    });
    for (let i = 0; i < VERSION_TAPS; i++) {
      fireEvent.press(screen.getByTestId('version-tap'));
    }
    await waitFor(() => screen.getByText('개발자 메뉴'));
    expect(screen.getByText(/APP_ENV local/)).toBeTruthy();
    expect(screen.getByText(/API_MODE fake/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '어르신으로'}));
    });
    await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
    expect(screen.queryByText('개발자 메뉴')).toBeNull();
  }, 15000); // 재확인 S2: 앱 전체를 그리는 흐름이라 첫 실행이 느릴 수 있다
});

describe('production 대역·fake 초기화', () => {
  test('production 대역(DevMenuHost.stub)은 메뉴가 없고 구현을 import 하지 않는다', () => {
    const {DevMenuHost: Stub} = require('../src/dev/DevMenuHost.stub');
    const {AppRoot} = require('../src/app/AppRoot');
    const api = createFakeApi({consented: true});
    render(<Stub api={api}>{({appKey}: {appKey: number}) => <AppRoot key={appKey} api={api} role="parent" />}</Stub>);
    expect(screen.queryByTestId('dev-menu')).toBeNull();
    const src: string = require('fs').readFileSync(path.join(__dirname, '../src/dev/DevMenuHost.stub.tsx'), 'utf8');
    expect(src).not.toMatch(/sessionSlots|testFamily|setSession|bumojasik-dev-menu-impl/);
  });

  test('fake 모드: 오늘 코스 초기화·하루 넘기기는 fake API 의 개발 훅으로', async () => {
    const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul']});
    expect((await api.getTodayContent())!.completed_steps).toHaveLength(3);
    api.__dev.resetToday();
    expect((await api.getTodayContent())!.completed_steps).toHaveLength(0);
    const before = (await api.getTodayContent())!.day_index;
    api.__dev.nextDay();
    expect((await api.getTodayContent())!.day_index).not.toBe(before);
  });

  test('M2: 자녀 로그아웃(처음으로)하면 앱이 보관 세션 정리 훅을 부른다', async () => {
    const {AppRoot} = require('../src/app/AppRoot');
    const fn = jest.fn(async () => {});
    registerDevSessionCleaner(fn);
    try {
      render(<AppRoot api={createFakeApi({consented: true})} role="child" />);
      await waitFor(() => screen.getByRole('button', {name: '설정'}));
      await act(async () => {
        fireEvent.press(screen.getByRole('button', {name: '설정'}));
      });
      await waitFor(() => screen.getByRole('button', {name: '로그아웃'}));
      await act(async () => {
        fireEvent.press(screen.getByRole('button', {name: '로그아웃'}));
      });
      const dialog = await screen.findByTestId('dialog');
      const {within} = require('@testing-library/react-native');
      await act(async () => {
        fireEvent.press(within(dialog).getByRole('button', {name: '로그아웃'}));
      });
      await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
      expect(fn).toHaveBeenCalled();
    } finally {
      registerDevSessionCleaner(null);
    }
  });
});
