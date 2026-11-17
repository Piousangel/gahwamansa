// staging 전용 개발자 메뉴: 진입 관문(production 불가)·번들 제외(Metro)·역할별 세션·테스트 가족·초기화
import React from 'react';
import {Text} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {isDevMenuAllowed, DevMenuContext, useVersionTaps, VERSION_TAPS} from '../src/dev/devGate';
import {createSessionSlots} from '../src/dev/sessionSlots';
import {createTestFamily} from '../src/dev/testFamily';
import {memoryStore} from '../src/lib/localStamps';
import {createFakeApi} from '../src/features/fakeApi';

declare const __dirname: string;
const path: {join(...p: string[]): string} = require('path');
const {bundleAppEnv, devMenuRedirect} = require('../metroDevMenu');

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

describe('번들 제외(Metro)', () => {
  const appDir = path.join(__dirname, '..');
  test('production 번들은 개발자 메뉴 구현 대신 빈 대역을 넣는다', () => {
    const impl = path.join(appDir, 'src/dev/DevMenuHost.tsx');
    expect(devMenuRedirect(impl, 'production', appDir)).toBe(path.join(appDir, 'src/dev/DevMenuHost.stub.tsx'));
    expect(devMenuRedirect(impl, 'staging', appDir)).toBeNull();
    expect(devMenuRedirect(path.join(appDir, 'src/app/AppRoot.tsx'), 'production', appDir)).toBeNull();
  });
  test('번들 환경은 Gradle 이 쓴 env.generated.ts 의 APP_ENV(없으면 local), 검사용 덮어쓰기 가능', () => {
    const read = (s: string | null) => bundleAppEnv('/x', {}, () => {
      if (s === null) {
        throw new Error('ENOENT');
      }
      return s;
    });
    expect(read('export default {\n  "APP_ENV": "production",\n  "API_MODE": "real"\n};')).toBe('production');
    expect(read('export default {\n  "APP_ENV": "staging"\n};')).toBe('staging');
    expect(read(null)).toBe('local');
    expect(bundleAppEnv('/x', {BUMOJASIK_BUNDLE_APP_ENV: 'production'}, () => '')).toBe('production');
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
  };
}

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
    expect(auth.calls[0]).toBe('password:kid@example.test');
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
  });
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
});
