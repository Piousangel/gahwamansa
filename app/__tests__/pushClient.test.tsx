import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {
  ANDROID_PUSH_CHANNELS,
  parseMyPushSettings,
  parsePushKind,
  parseRegisterPushToken,
  parseSetPushEnabled,
} from '../src/api/contract/push';
import {pushChannelSpecs} from '../src/push/channels';
import {COURSE_ORDER, parentStepAfterOpen} from '../src/push/openRoute';
import {
  acceptParentPrompt,
  childOptIn,
  readReceive,
  setReceive,
  declineParentPrompt,
  registerToken,
  retryPending,
  shouldPromptParent,
  type PushDeps,
} from '../src/push/pushClient';
import {createFakeTokenSource, FAKE_PUSH_TOKEN, nullTokenSource, setTokenSourceForTest, type PushTokenSource} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {readPushToken, setPushTokenStoreForTest} from '../src/lib/pushToken';
import {copy} from '../src/copy/copy';
import {press} from '../testUtils/flow';
// V1(11-19): N1 은 오늘 코스를 다 마친 뒤 코스 홈에서. 바로 N1 을 보려면 다 마친 상태로 시작한다
const ALL_DONE: ('photo' | 'question' | 'hangul')[] = ['photo', 'question', 'hangul'];

// AU-04 푸시 클라이언트(fake 토큰 경로). 서버 계약: dev-server-notes 2절(0032·0036·0037), 이벤트 0022·0034.
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const RN = require('react-native');

const setPlatform = (OS: string, Version: number) => {
  Object.defineProperty(RN.Platform, 'OS', {value: OS, configurable: true, writable: true});
  Object.defineProperty(RN.Platform, 'Version', {value: Version, configurable: true, writable: true});
};
const orig = {OS: RN.Platform.OS, Version: RN.Platform.Version};

beforeEach(() => {
  setPushTokenStoreForTest(memoryStore());
  setPushDepsForTest(null);
});
afterEach(() => {
  setTokenSourceForTest(null);
  setPlatform(orig.OS, orig.Version);
  jest.restoreAllMocks();
});

function deps(api = createFakeApi({linked: true, consented: true, pushEnabled: false}), source: PushTokenSource = createFakeTokenSource()): PushDeps {
  return {api, source, store: memoryStore()};
}

describe('계약(0032·0036)', () => {
  test('반환 검증기: 모르는 모양은 null(contract_mismatch)', () => {
    expect(parseRegisterPushToken({ok: true})).toEqual({ok: true});
    expect(parseRegisterPushToken({ok: false, reason: 'no_profile'})).toEqual({ok: false, reason: 'no_profile'});
    expect(parseRegisterPushToken({ok: false, reason: 'boom'})).toBeNull();
    expect(parseSetPushEnabled({ok: true, enabled: true})).toEqual({ok: true, enabled: true});
    expect(parseSetPushEnabled({ok: true})).toBeNull();
    expect(parseMyPushSettings({enabled: null})).toEqual({enabled: null});
    expect(parseMyPushSettings({})).toBeNull();
    expect(parsePushKind({kind: 'daily'})).toBe('daily');
    expect(parsePushKind({kind: 'x'})).toBeNull();
    expect(parsePushKind(null)).toBeNull();
  });

  test('가짜 토큰은 서버 형식(0032 정규식)을 지킨다', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261116000032_push_tokens.sql'), 'utf8');
    expect(sql).toContain("p_token !~ '^[A-Za-z0-9_:-]+$'");
    expect(FAKE_PUSH_TOKEN).toMatch(/^[A-Za-z0-9_:-]{20,}$/);
  });
});

describe('채널 3개', () => {
  test('id 는 계약 그대로, 이름·설명은 copy, 잠금 화면: daily 공개 · cheer·family 비공개', () => {
    const specs = pushChannelSpecs();
    expect(specs.map(s => s.id)).toEqual([...ANDROID_PUSH_CHANNELS]);
    expect(specs.map(s => s.visibility)).toEqual(['public', 'private', 'private']);
    expect(specs[1]).toMatchObject({name: copy.push.channel.cheer, description: copy.push.channel.cheer_desc, importance: 'default'});
  });
});

describe('토큰 등록', () => {
  test('성공한 토큰만 기기에 둔다(로그아웃 때 해제용), 프로필이 없으면 두지 않는다', async () => {
    const d = deps();
    const reg = jest.spyOn(d.api, 'registerPushToken');
    expect(await registerToken(d)).toBe('ok');
    expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN);
    expect(await readPushToken()).toBe(FAKE_PUSH_TOKEN);

    setPushTokenStoreForTest(memoryStore());
    expect(await registerToken(deps(createFakeApi({linked: false})))).toBe('no_profile');
    expect(await readPushToken()).toBeNull();
  });

  test('토큰이 없거나(Firebase 전 real) 형식이 틀리면 서버를 부르지 않는다', async () => {
    const d = deps(undefined, nullTokenSource);
    const reg = jest.spyOn(d.api, 'registerPushToken');
    expect(await registerToken(d)).toBe('no_token');
    expect(await registerToken({...d, source: createFakeTokenSource('short')})).toBe('no_token');
    expect(reg).not.toHaveBeenCalled();
  });
});

describe('어르신 N1 받기 동의', () => {
  test("'알려 주세요': set_push_enabled(true) 를 시스템 창보다 먼저, 결과 기록, 허용이면 토큰 등록", async () => {
    const d = deps();
    const order: string[] = [];
    jest.spyOn(d.api, 'setPushEnabled').mockImplementation(async v => {
      order.push(`enabled:${v}`);
      return {ok: true, enabled: v};
    });
    const log = jest.spyOn(d.api, 'logEvent');
    const reg = jest.spyOn(d.api, 'registerPushToken');
    const p = await acceptParentPrompt(d, async () => {
      order.push('request');
      return 'granted';
    });
    expect(p).toBe('granted');
    expect(order).toEqual(['enabled:true', 'request']);
    expect(log).toHaveBeenCalledWith('push_permission_result', {result: 'granted'});
    expect(reg).toHaveBeenCalled();
    expect(await shouldPromptParent(d)).toBe(false); // 다시 묻지 않음
  });

  test('시스템 창에서 거절해도 받기 동의는 남는다(OS 권한과 별개, 0036). 토큰은 등록하지 않음', async () => {
    const d = deps();
    const en = jest.spyOn(d.api, 'setPushEnabled');
    const reg = jest.spyOn(d.api, 'registerPushToken');
    const log = jest.spyOn(d.api, 'logEvent');
    await acceptParentPrompt(d, async () => 'blocked');
    expect(en).toHaveBeenCalledWith(true);
    expect(reg).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('push_permission_result', {result: 'denied'});
  });

  test('오프라인으로 동의를 못 보내면 기억했다가 다시 보낸다', async () => {
    const d = deps();
    const en = jest.spyOn(d.api, 'setPushEnabled').mockRejectedValueOnce(new Error('offline'));
    await acceptParentPrompt(d, async () => 'denied');
    expect(await shouldPromptParent(d)).toBe(false);
    await retryPending(d);
    expect(en).toHaveBeenCalledTimes(2);
    await retryPending(d);
    expect(en).toHaveBeenCalledTimes(2); // 보낸 뒤에는 다시 안 보냄
  });

  test("'안 받을게요': 서버 호출 없음, 다시 묻지 않음", async () => {
    const d = deps();
    const en = jest.spyOn(d.api, 'setPushEnabled');
    expect(await shouldPromptParent(d)).toBe(true);
    await declineParentPrompt(d);
    expect(await shouldPromptParent(d)).toBe(false);
    expect(en).not.toHaveBeenCalled();
  });

  test('서버가 이미 받는 중이거나(재설치) 연결 전이면 묻지 않는다', async () => {
    expect(await shouldPromptParent(deps(createFakeApi({linked: true, pushEnabled: true})))).toBe(false);
    expect(await shouldPromptParent(deps(createFakeApi({linked: false, pushEnabled: false})))).toBe(false);
  });
});

describe('받기 동의·끄기(리뷰 L2·L3·M1 API)', () => {
  test("자녀: '알림 켜기'를 누를 때만 동의 — 결과와 상관없이 서버 동의, 허용이면 토큰 등록", async () => {
    const api = createFakeApi({who: 'child', childFamily: true});
    const d = deps(api);
    const en = jest.spyOn(api, 'setPushEnabled');
    expect(await childOptIn(d, async () => 'blocked')).toBe(true);
    expect(en).toHaveBeenCalledWith(true);
    expect(await readPushToken()).toBeNull();
    await childOptIn(d, async () => 'granted');
    expect(await readPushToken()).toBe(FAKE_PUSH_TOKEN);
    expect(await childOptIn(deps(createFakeApi({who: 'child'})), async () => 'granted')).toBe(false); // 가족 전(no_profile)
  });

  test('앱 안 끄기: set_push_enabled(false) 후 N1 다시 묻지 않고, yes_pending 재시도가 다시 켜지 않는다', async () => {
    const d = deps();
    const en = jest.spyOn(d.api, 'setPushEnabled').mockRejectedValueOnce(new Error('offline'));
    await acceptParentPrompt(d, async () => 'granted'); // 동의 못 보냄 → yes_pending
    expect(await setReceive(d, false, async () => 'granted')).toEqual({ok: true, enabled: false});
    await retryPending(d);
    expect(en.mock.calls.map(c => c[0])).toEqual([true, false]); // 재시도 없음
    expect(await shouldPromptParent(d)).toBe(false);
    expect(await readReceive(d)).toBe(false);
  });

  test('재시도는 서버 값 먼저: 이미 받는 중이면 다시 부르지 않는다', async () => {
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true});
    const d = deps(api);
    const en = jest.spyOn(api, 'setPushEnabled').mockRejectedValueOnce(new Error('offline'));
    await acceptParentPrompt(d, async () => 'denied');
    await retryPending(d);
    expect(en).toHaveBeenCalledTimes(1);
  });

  test('켜기: 서버 동의 + 허용이면 토큰 등록, 실패는 값으로', async () => {
    const d = deps();
    const reg = jest.spyOn(d.api, 'registerPushToken');
    expect(await setReceive(d, true, async () => 'granted')).toEqual({ok: true, enabled: true});
    expect(reg).toHaveBeenCalled();
    expect(await setReceive(deps(createFakeApi({linked: false})), true, async () => 'granted')).toEqual({ok: false, reason: 'no_profile'});
    const off = deps();
    jest.spyOn(off.api, 'setPushEnabled').mockRejectedValueOnce(new Error('x'));
    expect(await setReceive(off, false, async () => 'granted')).toEqual({ok: false, reason: 'offline'});
    expect(await readReceive(deps(createFakeApi({linked: false})))).toBeNull();
  });
});

describe('U1 알림 탭 → 오늘 할 단계', () => {
  const content = (done: ('photo' | 'question' | 'hangul')[]) => ({photo: {}, question: {}, completed_steps: done});
  test('일일 알림은 첫 안 한 단계, 다 마쳤거나 콘텐츠가 없으면 P3, 응원은 P3', () => {
    expect(parentStepAfterOpen('daily', content([]))).toBe('PhotoStep');
    expect(parentStepAfterOpen('daily', content(['photo']))).toBe('QuestionStep');
    expect(parentStepAfterOpen('daily', content(['photo', 'question', 'hangul']))).toBeNull();
    expect(parentStepAfterOpen('daily', null)).toBeNull();
    expect(parentStepAfterOpen('cheer_arrived', content([]))).toBeNull();
  });
  test('코스 순서가 CourseHome STEPS 와 같다', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/features/course/CourseHome.tsx'), 'utf8');
    const pairs = [...src.matchAll(/\{step: '(\w+)', route: '(\w+)'\}/g)].map(m => ({step: m[1], route: m[2]}));
    expect(pairs).toEqual(COURSE_ORDER);
  });
});

describe('앱 조립(PushHost)', () => {
  test('N1: 동의한 어르신이 코스 홈에 오면 한 번 → 알려 주세요 → 시스템 창 → 코스 홈으로', async () => {
    setPlatform('android', 34);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('granted');
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const en = jest.spyOn(api, 'setPushEnabled');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByLabelText(copy.push.permission.title), {timeout: 8000});
    expect(screen.getByLabelText(copy.push.permission.preview_a11y)).toBeTruthy();
    expect(screen.getByLabelText(copy.push.permission.optional)).toBeTruthy();
    await press(copy.push.permission.yes);
    await waitFor(() => expect(screen.queryByLabelText(copy.push.permission.title)).toBeNull());
    expect(en).toHaveBeenCalledWith(true);
    expect(request).toHaveBeenCalled();
  });

  test('PR #65 L1: 답 보여 주기에 동의하지 않은 어르신에게도 코스를 마치면 N1 을 띄운다(별개 동의)', async () => {
    const api = createFakeApi({linked: true, consented: false, pushEnabled: false, completedSteps: ALL_DONE});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}), {timeout: 8000});
  });

  test('N1 은 이미 받는 중이면 뜨지 않는다', async () => {
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true, completedSteps: ALL_DONE});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('screen-dock'), {timeout: 8000});
    await waitFor(() => expect(my).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole('button', {name: copy.push.permission.yes})).toBeNull();
  });

  test('PR #65 L3: 오프라인으로 확인을 못 하면 앱이 앞으로 돌아올 때(active) 다시 확인해 띄운다, 답한 뒤에는 다시 안 띄움', async () => {
    const handlers: ((s: string) => void)[] = [];
    jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((type: string, h: (st: string) => void) => {
      if (type === 'change') {
        handlers.push(h);
      }
      return {remove: jest.fn()};
    }) as never);
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('denied');
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const real = api.myPushSettings.bind(api);
    const my = jest.spyOn(api, 'myPushSettings').mockRejectedValueOnce(new Error('offline'));
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('screen-dock'), {timeout: 8000});
    await waitFor(() => expect(my).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByRole('button', {name: copy.push.permission.yes})).toBeNull();
    my.mockImplementation(real);
    await act(async () => {
      handlers.forEach(h => h('active'));
    });
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}), {timeout: 8000});
    await press(copy.push.permission.no);
    await waitFor(() => expect(screen.queryByRole('button', {name: copy.push.permission.yes})).toBeNull());
    const calls = my.mock.calls.length;
    await act(async () => {
      handlers.forEach(h => h('active'));
    });
    await waitFor(() => expect(my.mock.calls.length).toBeGreaterThan(calls));
    await act(async () => {});
    expect(screen.queryByRole('button', {name: copy.push.permission.yes})).toBeNull();
  });

  test('어르신 일일 알림 탭: push_opened{daily} + [P3, 사진 보기]', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({linked: true, consented: true});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('screen-dock'), {timeout: 8000});
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await waitFor(() => expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'daily'}));
    await waitFor(() => screen.getByTestId('photo-polaroid'), {timeout: 8000});
  });

  test('꺼진 앱을 알림으로 열면(초기 알림) 코스 홈을 거쳐 그 단계로', async () => {
    const src = createFakeTokenSource();
    src.setInitialOpen({kind: 'daily'});
    setTokenSourceForTest(src);
    const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo']});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('choice-group'), {timeout: 8000});
  });

  test('자녀 연결 알림 탭: handleChildPushOpen 경로(push_opened + 앨범)', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}), {timeout: 8000});
    await act(async () => {
      src.emitOpen({kind: 'parent_connected'});
    });
    await waitFor(() => expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'parent_connected'}));
  });

  test('자녀 C3 알림 켜기 → 허용이면 받기 동의(set_push_enabled true)·토큰 등록', async () => {
    setPlatform('android', 34);
    setTokenSourceForTest(createFakeTokenSource());
    let allowed = false;
    jest.spyOn(RN.PermissionsAndroid, 'check').mockImplementation(async () => allowed);
    jest.spyOn(RN.PermissionsAndroid, 'request').mockImplementation(async () => {
      allowed = true;
      return 'granted';
    });
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'});
    const en = jest.spyOn(api, 'setPushEnabled');
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByRole('button', {name: '알림 켜기'}), {timeout: 8000});
    expect(en).not.toHaveBeenCalled(); // 묻기 전에는 동의 아님
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '알림 켜기'}));
    });
    await waitFor(() => expect(en).toHaveBeenCalledWith(true));
    await waitFor(() => expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN));
    await waitFor(() => expect(screen.queryByTestId('wait-notify')).toBeNull());
  });
  test('리뷰 L1: 시스템 창이 뜨지 않으면(blocked) N1 이 닫히지 않고 휴대폰 설정 안내', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const settings = jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    render(<AppRoot api={createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE})} role="parent" restore />);
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}), {timeout: 8000});
    await press(copy.push.permission.yes);
    await waitFor(() => screen.getByTestId('n1-system-off'));
    await press(copy.push.system_off.open_parent);
    expect(settings).toHaveBeenCalled();
    await press(copy.push.permission.no);
    await waitFor(() => expect(screen.queryByTestId('n1-system-off')).toBeNull());
  });

  test('리뷰 L2: 자녀는 권한이 이미 허용이어도 누르기 전에는 받기 동의를 보내지 않는다(토큰 등록만)', async () => {
    setPlatform('android', 34);
    setTokenSourceForTest(createFakeTokenSource());
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const en = jest.spyOn(api, 'setPushEnabled');
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN), {timeout: 8000});
    expect(en).not.toHaveBeenCalled();
  });

  test('리뷰 L4: 연결 전 어르신도 권한이 있으면 토큰 등록을 부른다(no_profile 은 정상)', async () => {
    setPlatform('android', 34);
    setTokenSourceForTest(createFakeTokenSource());
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi();
    const reg = jest.spyOn(api, 'registerPushToken');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => expect(reg).toHaveBeenCalled(), {timeout: 8000});
    expect(await readPushToken()).toBeNull();
  });

  test('리뷰 L6: N1 같은 진행 중 화면은 알림 탭이 끊지 않고, 떠난 뒤 처리', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}), {timeout: 8000});
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    expect(screen.getByRole('button', {name: copy.push.permission.yes})).toBeTruthy();
    expect(log).not.toHaveBeenCalledWith('push_opened', expect.anything());
    await press(copy.push.permission.no);
    await waitFor(() => expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'daily'}));
    await waitFor(() => screen.getByTestId('date-line'), {timeout: 8000}); // 오늘 코스를 다 마쳤으니 일일 알림은 [P3](U1)
  });

  test('리뷰 L5·L7: 자녀 — 계정이 바뀌면 처리 못 한 탭을 버리고, 어르신 종류는 버린다', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    let tag = 'acc-a';
    jest.spyOn(api, 'accountTag').mockImplementation(async () => tag);
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}), {timeout: 8000});
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await press('설정'); // 탭 밖 화면: 연결 알림은 보류
    await act(async () => {
      src.emitOpen({kind: 'parent_connected'});
    });
    tag = 'acc-b';
    await act(async () => {
      fireEvent.press(screen.getAllByRole('button', {name: copy.nav.back_a11y})[0]);
    });
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await act(async () => {});
    expect(log).not.toHaveBeenCalledWith('push_opened', expect.anything());
  });

  test('역할을 고르기 전(첫 화면) 알림 탭은 버린다', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} />);
    await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'), {timeout: 8000});
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await act(async () => {});
    expect(log).not.toHaveBeenCalledWith('push_opened', expect.anything());
  });
});
