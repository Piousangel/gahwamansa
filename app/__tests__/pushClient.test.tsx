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
  childPermissionGranted,
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

  test("'괜찮아요': 서버 호출 없음, 다시 묻지 않음", async () => {
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

describe('자녀 권한 허용 = 받기 동의(이 계정에서 한 번)', () => {
  test('허용 확인 때 set_push_enabled(true) 한 번 + 토큰 등록, 프로필이 없으면 다음에 다시', async () => {
    const api = createFakeApi({who: 'child', childFamily: true});
    const d = deps(api);
    const en = jest.spyOn(api, 'setPushEnabled');
    await childPermissionGranted(d);
    await childPermissionGranted(d);
    expect(en).toHaveBeenCalledTimes(1);
    expect(await readPushToken()).toBe(FAKE_PUSH_TOKEN);

    const noFam = deps(createFakeApi({who: 'child'}));
    const en2 = jest.spyOn(noFam.api, 'setPushEnabled');
    await childPermissionGranted(noFam);
    await childPermissionGranted(noFam);
    expect(en2).toHaveBeenCalledTimes(2); // no_profile 이라 기억하지 않음
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
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false});
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

  test('N1 은 동의 안 한 어르신·이미 받는 중이면 뜨지 않는다', async () => {
    const api = createFakeApi({linked: true, consented: false, pushEnabled: false});
    const my = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('screen-dock'), {timeout: 8000});
    await act(async () => {});
    expect(screen.queryByLabelText(copy.push.permission.title)).toBeNull();
    expect(my).not.toHaveBeenCalled();
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
});
