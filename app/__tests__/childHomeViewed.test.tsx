// 기획 v2.1 측정(0066): child_home_viewed — 자녀 홈을 연 날 하루 한 번(KST), 속성 없음, 계정마다.
// 서버가 같은 KST 날짜 두 번째를 저장하지 않는 것은 supabase/tests/child_home_viewed.test.sql. 여기서는 앱이 언제·몇 번 보내는지를 본다:
// 하루 1회(다시 들어와도·백그라운드에서 돌아와도 0번 더), 다음 날 다시, 오류면 다음에 다시(표시 안 함), 응답 실패(한도·계약)는 다시 안 보냄.
import React from 'react';
import {AppState, PixelRatio} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {trackDaily} from '../src/features/track';
import {EVENT_NAMES} from '../src/api/contract/events';
import {OfflineError} from '../src/features/types';
import {setupWarmAppRoot} from '../testUtils/warm';

setupWarmAppRoot();
jest.setTimeout(20000);

let handlers: ((s: string) => void)[] = [];
beforeEach(() => {
  setPrefsForTest(createPrefs(memoryStore()));
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
  handlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handlers.push(h);
    return {remove: () => (handlers = handlers.filter(x => x !== h))};
  }) as never);
});
afterEach(() => {
  setPrefsForTest(null);
  jest.restoreAllMocks();
});

const callsOf = (log: jest.SpyInstance, name: string) => log.mock.calls.filter(c => c[0] === name).map(c => c[1]);
const toBackgroundAndBack = async () => {
  await act(async () => {
    handlers.forEach(h => h('background'));
  });
  await act(async () => {
    handlers.forEach(h => h('active'));
  });
};

test('계약: 이름이 EVENT_NAMES 에 있다(서버 0066 목록과의 대조는 eventsContract.test)', () => {
  expect(EVENT_NAMES).toContain('child_home_viewed');
});

test('자녀 홈을 열면 한 번, 속성 없음(빈 객체) — 계정 가명값·답 내용 없음', async () => {
  const api = createFakeApi({consented: true, parentTitle: '엄마', accountTag: 'acc-secret'});
  const log = jest.spyOn(api, 'logEvent');
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => expect(callsOf(log, 'child_home_viewed')).toEqual([{}]));
  expect(JSON.stringify(log.mock.calls)).not.toContain('acc-secret');
});

test('같은 날: 백그라운드에서 돌아와도, 화면을 다시 열어도 더 보내지 않는다(중복 0)', async () => {
  const api = createFakeApi({consented: true, parentTitle: '엄마'});
  const log = jest.spyOn(api, 'logEvent');
  const {unmount} = render(<AppRoot api={api} role="child" />);
  await waitFor(() => expect(callsOf(log, 'child_home_viewed')).toHaveLength(1));
  await toBackgroundAndBack();
  await toBackgroundAndBack();
  unmount();
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => expect(screen.getByRole('button', {name: '응원 보내기'})).toBeEnabled());
  await toBackgroundAndBack();
  expect(callsOf(log, 'child_home_viewed')).toHaveLength(1);
});

test('어르신 홈에서는 보내지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const log = jest.spyOn(api, 'logEvent');
  render(<AppRoot api={api} role="parent" />);
  await act(async () => {});
  await toBackgroundAndBack();
  expect(callsOf(log, 'child_home_viewed')).toEqual([]);
});

describe('trackDaily', () => {
  test('KST 날짜가 바뀌면 다시 한 번', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    await trackDaily(api, 'child_home_viewed', '2026-12-02');
    await trackDaily(api, 'child_home_viewed', '2026-12-02');
    expect(callsOf(log, 'child_home_viewed')).toEqual([{}, {}]);
  });

  test('같은 틱에 두 번 불려도 한 번', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    await Promise.all([trackDaily(api, 'child_home_viewed', '2026-12-01'), trackDaily(api, 'child_home_viewed', '2026-12-01')]);
    expect(callsOf(log, 'child_home_viewed')).toHaveLength(1);
  });

  test('실패: 네트워크 오류면 표시하지 않아 다음에 다시 보내고, 성공한 뒤로는 보내지 않는다', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent').mockRejectedValueOnce(new OfflineError('offline'));
    await expect(trackDaily(api, 'child_home_viewed', '2026-12-01')).resolves.toBeUndefined(); // 화면으로 예외가 나가지 않는다
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    expect(callsOf(log, 'child_home_viewed')).toHaveLength(2);
  });

  test.each(['rate_limited', 'no_user', 'invalid_props'] as const)('응답 실패(%s)는 같은 날 다시 보내지 않는다(되풀이 0)', async reason => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const api = createFakeApi({eventResult: reason});
    const log = jest.spyOn(api, 'logEvent');
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    expect(callsOf(log, 'child_home_viewed')).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(reason === 'invalid_props' ? 1 : 0); // 계약 어긋남만 개발 경고
  });

  test('계정마다 따로(같은 기기 다른 자녀 계정), 가명값을 모르면 보내지 않는다', async () => {
    let tag: string | null = 'acc-a';
    const api = createFakeApi();
    jest.spyOn(api, 'accountTag').mockImplementation(async () => tag);
    const log = jest.spyOn(api, 'logEvent');
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    tag = 'acc-b';
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    tag = null;
    await trackDaily(api, 'child_home_viewed', '2026-12-01');
    expect(callsOf(log, 'child_home_viewed')).toHaveLength(2);
  });
});
