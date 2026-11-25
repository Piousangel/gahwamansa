import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
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
  parentPromptState,
  skipParentPromptToday,
  type PushDeps,
} from '../src/push/pushClient';
import {createFakeTokenSource, FAKE_PUSH_TOKEN, nullTokenSource, setTokenSourceForTest, type PushTokenSource} from '../src/push/tokenSource';
import {setPushDepsForTest} from '../src/push/runtime';
import {memoryStore} from '../src/lib/kvStore';
import {readPushToken, setPushTokenStoreForTest} from '../src/lib/pushToken';
import {copy} from '../src/copy/copy';
import {navRef} from '../src/navigation/navRef';
import {press} from '../testUtils/flow';
import {coverQueue} from '../src/ui/ds/coverQueue';
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
    expect(await registerToken(d, true)).toBe('ok');
    expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN);
    expect(await readPushToken()).toBe(FAKE_PUSH_TOKEN);

    setPushTokenStoreForTest(memoryStore());
    expect(await registerToken(deps(createFakeApi({linked: false})), true)).toBe('no_profile');
    expect(await readPushToken()).toBeNull();
  });

  test('토큰이 없거나(Firebase 전 real) 형식이 틀리면 서버를 부르지 않는다', async () => {
    const d = deps(undefined, nullTokenSource);
    const reg = jest.spyOn(d.api, 'registerPushToken');
    expect(await registerToken(d, true)).toBe('no_token');
    expect(await registerToken({...d, source: createFakeTokenSource('short')}, true)).toBe('no_token');
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

// N1 은 P7 의 연속(리드 결정 ⓐ, #168): 이번 실행에서 P7(CourseDone) → 코스 홈으로 돌아왔을 때만. 앱을 열 때·깨어날 때는 묻지 않는다
async function renderHome(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('screen-dock'), {timeout: 8000});
}
async function backFromP7() {
  const {navRef} = require('../src/navigation/navRef');
  await act(async () => {
    navRef.navigate('CourseDone');
  });
  await act(async () => {
    navRef.navigate('CourseHome'); // P7 '알겠어요'(popTo 코스 홈)와 같은 경로
  });
}
function wakeHandlers() {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((type: string, h: (st: string) => void) => {
    if (type === 'change') {
      handlers.push(h);
    }
    return {remove: jest.fn()};
  }) as never);
  return async () => {
    await act(async () => {
      handlers.forEach(h => h('active'));
    });
  };
}

describe('앱 조립(PushHost)', () => {
  test('N1: P7 뒤 코스 홈에서 한 번 → 알려 주세요(아래 미리 알림 한 줄) → 시스템 창 → 닫힘', async () => {
    setPlatform('android', 34);
    const request = jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('granted');
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const en = jest.spyOn(api, 'setPushEnabled');
    await renderHome(api);
    await backFromP7();
    await waitFor(() => screen.getByTestId('n1'));
    // v4(ds Dialog, 시안 P6_P7_N1_P2_ds4b N1): 제목·하루 한 번·안 받아도 그대로, 알림 예시 그림은 없다
    expect(screen.getByLabelText(copy.push.permission.body)).toBeTruthy();
    expect(screen.getByLabelText(copy.push.permission.optional)).toBeTruthy();
    expect(screen.queryByLabelText(copy.push.permission.preview_a11y)).toBeNull();
    expect(within(screen.getByTestId('n1')).getByText(copy.push.permission.system_hint, {includeHiddenElements: true, normalizer: (x: string) => x.replace(/\u2060/g, '').trim()})).toBeTruthy(); // 접근성 M3: 알려 주세요 아래 한 줄
    expect(screen.getByRole('button', {name: copy.push.permission.yes}).props.accessibilityHint).toBe(copy.push.permission.system_hint);
    await press(copy.push.permission.yes);
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    expect(en).toHaveBeenCalledWith(true);
    expect(request).toHaveBeenCalled();
  });

  test('리드 ⓐ: 앱을 열 때(코스를 이미 마친 날)·깨어날 때는 묻지 않는다 — 진입 즉시 권한 묻기 금지', async () => {
    const wake = wakeHandlers();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const my = jest.spyOn(api, 'myPushSettings');
    await renderHome(api);
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
    await wake();
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
    expect(my).not.toHaveBeenCalled();
  });

  test('PR #65 L1: 답 보여 주기에 동의하지 않은 어르신에게도 P7 뒤 N1 을 띄운다(별개 동의)', async () => {
    const api = createFakeApi({linked: true, consented: false, pushEnabled: false, completedSteps: ALL_DONE});
    await renderHome(api);
    await backFromP7();
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}), {timeout: 8000});
  });

  test('N1 은 이미 받는 중이면 뜨지 않는다', async () => {
    const api = createFakeApi({linked: true, consented: true, pushEnabled: true, completedSteps: ALL_DONE});
    const my = jest.spyOn(api, 'myPushSettings');
    await renderHome(api);
    await backFromP7();
    await waitFor(() => expect(my).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
  });

  test('오프라인으로 확인을 못 하면 이번에는 묻지 않고(깨어남에도 묻지 않음), 다음 P7 뒤에 묻는다. 안 받을게요 뒤에는 다시 묻지 않는다', async () => {
    const wake = wakeHandlers();
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const real = api.myPushSettings.bind(api);
    const my = jest.spyOn(api, 'myPushSettings').mockRejectedValueOnce(new Error('offline'));
    await renderHome(api);
    await backFromP7();
    await waitFor(() => expect(my).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
    my.mockImplementation(real);
    await wake();
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
    await backFromP7();
    await waitFor(() => screen.getByTestId('n1'));
    await press(copy.push.permission.no);
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    const calls = my.mock.calls.length;
    await backFromP7();
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
    expect(my.mock.calls.length).toBe(calls); // 이 계정 답을 먼저 보고 서버에도 안 묻는다
  });

  test('PR #72 M1: 뒤로(답 없이) 닫으면 같은 날 P7 뒤에도 다시 뜨지 않고, 거절로 기록하지도 않는다', async () => {
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const en = jest.spyOn(api, 'setPushEnabled');
    await renderHome(api);
    await backFromP7();
    await waitFor(() => screen.getByTestId('n1'));
    await act(async () => {
      screen.UNSAFE_getByType(RN.Modal).props.onRequestClose(); // 하드웨어 뒤로 = 오늘은 넘김
    });
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    await backFromP7();
    await act(async () => {});
    expect(screen.queryByTestId('n1')).toBeNull();
    expect(en).not.toHaveBeenCalled(); // 받기 동의도 거절도 보내지 않음
  });

  test('PR #72 M1: 넘긴 날이 지나면(다음 날) 다시 묻는다 — 넘김은 거절(no)이 아니다', async () => {
    const d = deps();
    expect(await parentPromptState(d, '2026-11-19')).toBe('ask');
    await skipParentPromptToday(d, '2026-11-19');
    expect(await parentPromptState(d, '2026-11-19')).toBe('skip');
    expect(await parentPromptState(d, '2026-11-20')).toBe('ask');
  });

  test('어르신 일일 알림 탭: push_opened{daily} + [P3, 사진 보기]', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({linked: true, consented: true});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('screen-dock'));
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await waitFor(() => expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'daily'}));
    await waitFor(() => screen.getByTestId('photo-polaroid'));
  });

  test('꺼진 앱을 알림으로 열면(초기 알림) 코스 홈을 거쳐 그 단계로', async () => {
    const src = createFakeTokenSource();
    src.setInitialOpen({kind: 'daily'});
    setTokenSourceForTest(src);
    const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo']});
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('choice-group'));
  });

  test('자녀 연결 알림 탭: handleChildPushOpen 경로(push_opened + 앨범)', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await act(async () => {
      src.emitOpen({kind: 'parent_connected'});
    });
    await waitFor(() => expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'parent_connected'}));
  });

  test('0052 첫 답 알림(parent_first_answer) 탭: 지난 날 탭에 있어도 자녀 홈(앨범)으로 + push_opened', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await act(async () => {
      fireEvent.press(screen.getByRole('tab', {name: '지난 날'}));
    });
    await waitFor(() => expect(navRef.getCurrentRoute()?.name).toBe('Past'));
    await act(async () => {
      src.emitOpen({kind: 'parent_first_answer'});
    });
    await waitFor(() => expect(navRef.getCurrentRoute()?.name).toBe('Album'));
    expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'parent_first_answer'});
    // 라이터 키(0052가 쓰는 push.first_answer): 제목·본문이 있고 자리값은 {호칭}만(답 내용·시각 없음)
    const fa = (copy.push as unknown as Record<string, {title: string; body: string}>).first_answer;
    expect(fa.title).toBeTruthy();
    expect(fa.body).toBeTruthy();
    expect((`${fa.title} ${fa.body}`.match(/\{[^}]+\}/g) ?? []).every(m => m === '{호칭}')).toBe(true);
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
    await waitFor(() => screen.getByRole('button', {name: '알림 켜기'}));
    expect(en).not.toHaveBeenCalled(); // 묻기 전에는 동의 아님
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '알림 켜기'}));
    });
    await waitFor(() => expect(en).toHaveBeenCalledWith(true));
    await waitFor(() => expect(reg).toHaveBeenCalledWith(FAKE_PUSH_TOKEN));
    await waitFor(() => expect(screen.queryByTestId('wait-notify')).toBeNull());
  });
  test('리뷰 L1·#168: 시스템 창이 뜨지 않으면(blocked) 닫지 않고 본문을 안내 한 줄(notice 톤)로, 닫는 말은 닫기(이미 서버 동의·다시 묻지 않음)', async () => {
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    const settings = jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    await renderHome(createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE}));
    await backFromP7();
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}));
    await press(copy.push.permission.yes);
    await waitFor(() => screen.getByTestId('n1-system-off'));
    expect(within(screen.getByTestId('n1-scroll')).getByTestId('n1-system-off')).toBeTruthy(); // 스크롤 안(접근성 M2)
    expect(screen.queryByLabelText(copy.push.permission.body)).toBeNull(); // 본문을 바꿔 끼움
    expect(screen.queryByTestId('n1-error')).toBeNull(); // 오류(danger) 줄이 아니다
    expect(screen.queryByRole('button', {name: copy.push.permission.no})).toBeNull();
    await press(copy.push.system_off.open_parent);
    expect(settings).toHaveBeenCalled();
    await press('닫기');
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
  });

  test('#168 접근성 M1: 설정에서 켜고 돌아오면 권한을 다시 읽어 알리고 닫는다', async () => {
    const wake = wakeHandlers();
    setPlatform('android', 34);
    jest.spyOn(RN.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
    const check = jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(RN.Linking, 'openSettings').mockResolvedValue(undefined);
    const say = jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility');
    await renderHome(createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE}));
    await backFromP7();
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}));
    await press(copy.push.permission.yes);
    await waitFor(() => screen.getByTestId('n1-system-off'));
    await press(copy.push.system_off.open_parent);
    check.mockResolvedValue(true); // 휴대폰 설정에서 켬
    await wake();
    await waitFor(() => expect(screen.queryByTestId('n1')).toBeNull());
    expect(say).toHaveBeenCalledWith(copy.push.permission.turned_on);
  });

  test('리뷰 L2·대기열 38: 자녀는 권한이 이미 허용이어도 누르기 전에는 받기 동의를 보내지 않고 토큰도 요청하지 않는다', async () => {
    setPlatform('android', 34);
    const src = createFakeTokenSource();
    const getToken = jest.spyOn(src, 'getToken');
    setTokenSourceForTest(src);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const en = jest.spyOn(api, 'setPushEnabled');
    const reg = jest.spyOn(api, 'registerPushToken');
    const settings = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => expect(settings).toHaveBeenCalled()); // 동의 확인까지 갔다
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 50));
    });
    expect(en).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
  });

  test('대기열 38(옛 리뷰 L4 대체): 연결 전 어르신은 권한이 있어도 받기 동의가 없어 토큰을 요청하지 않는다', async () => {
    setPlatform('android', 34);
    const src = createFakeTokenSource();
    const getToken = jest.spyOn(src, 'getToken');
    setTokenSourceForTest(src);
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    const api = createFakeApi();
    const reg = jest.spyOn(api, 'registerPushToken');
    const settings = jest.spyOn(api, 'myPushSettings');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => expect(settings).toHaveBeenCalled());
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 50));
    });
    expect(getToken).not.toHaveBeenCalled();
    expect(reg).not.toHaveBeenCalled();
    expect(await readPushToken()).toBeNull();
  });

  test('리드 ⓐ: N1 은 덮개 큐를 쓰지 않는다 — 오늘 다른 덮개가 떴어도 P7 뒤에는 묻는다', async () => {
    expect(await coverQueue.request('other-cover')).toBe(true);
    coverQueue.release('other-cover');
    await renderHome(createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE}));
    await backFromP7();
    await waitFor(() => screen.getByTestId('n1'));
  });

  test('리뷰 L6: N1 같은 진행 중 화면은 알림 탭이 끊지 않고, 떠난 뒤 처리', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({linked: true, consented: true, pushEnabled: false, completedSteps: ALL_DONE});
    const log = jest.spyOn(api, 'logEvent');
    await renderHome(api);
    await backFromP7();
    await waitFor(() => screen.getByRole('button', {name: copy.push.permission.yes}));
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    expect(screen.getByRole('button', {name: copy.push.permission.yes})).toBeTruthy();
    expect(log).not.toHaveBeenCalledWith('push_opened', expect.anything());
    await press(copy.push.permission.no);
    await waitFor(() => expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'daily'}));
    await waitFor(() => screen.getByTestId('date-line')); // 오늘 코스를 다 마쳤으니 일일 알림은 [P3](U1)
  });

  test('리뷰 L5·L7: 자녀 — 계정이 바뀌면 처리 못 한 탭을 버리고, 어르신 종류는 버린다', async () => {
    const src = createFakeTokenSource();
    setTokenSourceForTest(src);
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    let tag = 'acc-a';
    jest.spyOn(api, 'accountTag').mockImplementation(async () => tag);
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await press('설정'); // 탭 밖 화면: 연결 알림은 보류
    await act(async () => {
      src.emitOpen({kind: 'parent_connected'});
    });
    tag = 'acc-b';
    await act(async () => {
      fireEvent.press(screen.getAllByRole('button', {name: copy.nav.to.Album})[0]); // 탭(앨범) 위에서 연 설정 → '앨범으로'(W-09)
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
    await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await act(async () => {});
    expect(log).not.toHaveBeenCalledWith('push_opened', expect.anything());
  });
});
