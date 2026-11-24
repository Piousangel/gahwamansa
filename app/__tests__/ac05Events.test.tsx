// AC-05 측정(UX 깊이 회의 V10, DECISIONS 11-19 '측정'): 발신 0이던 운영 퍼널 이벤트 11개 + course_step_started.
// 이름·속성은 서버 화이트리스트(0053) 안에서만 — eventsContract.test 가 이름 목록을, 여기서는 "어디서 무엇을 보내는지"를 본다.
// 글자 내용·번호·답 내용은 어느 이벤트에도 싣지 않는다.
import React from 'react';
import {Share, PixelRatio} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {daysSinceYmd} from '../src/lib/childFormat';
import {trackOnce} from '../src/features/track';
import {EVENT_NAMES, EVENT_PROP_VALUES} from '../src/api/contract/events';
import {enterCode, press, pressCourseNext, toHomeConsented} from '../testUtils/flow';
import type {Api} from '../src/features/types';
import * as clipboard from '../src/ui/clipboard';
import {warmAppRoot} from '../testUtils/warm';

// 콜드 스타트 예열(#125 리뷰): 첫 AppRoot 테스트만 부하에 시간 초과하던 것. prefs 는 beforeEach 에서 새로 만드므로 예열이 app_first_open 을 먼저 쓰지 않는다(파일 전체로 확인)
beforeAll(warmAppRoot);

jest.setTimeout(20000);
beforeEach(() => {
  setPrefsForTest(createPrefs(memoryStore()));
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
});
afterEach(() => {
  setPrefsForTest(null);
  jest.restoreAllMocks();
});

const events = (log: jest.SpyInstance) => log.mock.calls.map(c => c[0] as string);
const callsOf = (log: jest.SpyInstance, name: string) => log.mock.calls.filter(c => c[0] === name).map(c => c[1]);

test('계약: course_step_started 이름과 result finished 값이 있다(서버 0053와 같음)', () => {
  expect(EVENT_NAMES).toContain('course_step_started');
  expect(EVENT_PROP_VALUES.result).toEqual(expect.arrayContaining(['finished', 'skipped']));
});

describe('설치·역할: app_first_open', () => {
  test('역할을 고르면 role_guess 와 함께 한 번, 처음 화면으로 돌아와 다시 골라도 또 보내지 않는다', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    const {unmount} = render(<AppRoot api={api} />);
    await press(/부모님 휴대폰이에요/);
    await waitFor(() => expect(callsOf(log, 'app_first_open')).toEqual([{role_guess: 'parent'}]));
    unmount();
    render(<AppRoot api={api} />);
    await press(/자녀 휴대폰이에요/);
    await act(async () => {});
    expect(callsOf(log, 'app_first_open')).toHaveLength(1);
  });

  test('trackOnce: 같은 틱에 두 번 불려도 한 번', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    await Promise.all([trackOnce(api, 'app_first_open', {role_guess: 'child'}), trackOnce(api, 'app_first_open', {role_guess: 'child'})]);
    expect(callsOf(log, 'app_first_open')).toEqual([{role_guess: 'child'}]);
  });
});

describe('realApi: 세션 전 이벤트는 들고 있다가 세션이 생기면 보낸다(no_user 로 버려지지 않게)', () => {
  function fakeSb() {
    let session: object | null = null;
    const rpc = jest.fn(async (name: string, _args?: unknown) => (name === 'log_event' ? {data: {ok: true}, error: null} : {data: null, error: null}));
    const sb = {
      auth: {
        getSession: jest.fn(async () => ({data: {session}, error: null})),
        signInAnonymously: jest.fn(async () => {
          session = {user: {id: 'anon'}};
          return {error: null};
        }),
      },
      rpc,
    };
    return {sb, rpc, login: () => (session = {user: {id: 'u'}})};
  }

  test('세션 없음 → 익명 사용자를 만들지 않고 보관, 다음 logEvent 때 먼저 보낸다', async () => {
    const {sb, rpc, login} = fakeSb();
    const api = createRealApi(sb as never, undefined, 'android');
    await expect(api.logEvent('app_first_open', {role_guess: 'child'})).resolves.toEqual({ok: false, reason: 'no_user'});
    expect(rpc).not.toHaveBeenCalled();
    expect(sb.auth.signInAnonymously).not.toHaveBeenCalled();
    login(); // 자녀 카카오 로그인
    await api.logEvent('child_signup_completed', {login_method: 'kakao'});
    expect(rpc.mock.calls.map(c => (c[1] as {p_name: string}).p_name)).toEqual(['app_first_open', 'child_signup_completed']);
  });

  test('어르신: 익명 세션을 만드는 첫 호출(ensureSession) 뒤 바로 보낸다, 한 번만', async () => {
    const {sb, rpc} = fakeSb();
    const api = createRealApi(sb as never, undefined, 'android');
    await api.logEvent('app_first_open', {role_guess: 'parent'});
    await api.peekInviteCode('123456').catch(() => {}); // ensureSession → 세션 생김 → 보관분 전송
    const sent = rpc.mock.calls.filter(c => c[0] === 'log_event').map(c => c[1]);
    expect(sent).toEqual([{p_name: 'app_first_open', p_props: {role_guess: 'parent'}}]);
    await api.logEvent('consent_shown');
    expect(rpc.mock.calls.filter(c => c[0] === 'log_event')).toHaveLength(2);
  });
});

describe('동의(P2): consent_shown · parent_consent_accepted · parent_consent_declined', () => {
  async function toConsent(api: Api) {
    render(<AppRoot api={api} role="parent" />);
    await enterCode('123456');
    await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  }

  test('보이면 consent_shown, 좋아요 → 저장된 뒤 accepted{consent_version}', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    await toConsent(api);
    await waitFor(() => expect(callsOf(log, 'consent_shown')).toHaveLength(1));
    await press('좋아요');
    await waitFor(() => expect(callsOf(log, 'parent_consent_accepted')).toEqual([{consent_version: expect.stringMatching(/^v\d+$/)}]));
    expect(events(log)).not.toContain('parent_consent_declined');
  });

  test('싫어요 → declined', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    await toConsent(api);
    await press('싫어요');
    expect(callsOf(log, 'parent_consent_declined')).toHaveLength(1);
    expect(events(log)).not.toContain('parent_consent_accepted');
  });

  test('저장이 실패하면 accepted 를 보내지 않는다', async () => {
    const api = createFakeApi();
    jest.spyOn(api, 'giveConsent').mockRejectedValueOnce(new Error('x'));
    const log = jest.spyOn(api, 'logEvent');
    await toConsent(api);
    await press('좋아요');
    await waitFor(() => screen.getByTestId('consent-error'));
    expect(events(log)).not.toContain('parent_consent_accepted');
  });

  test('이미 동의한 기기는 동의 화면을 건너뛰고 consent_shown 도 없다', async () => {
    const api = createFakeApi({consented: true});
    const log = jest.spyOn(api, 'logEvent');
    await toHomeConsented(api);
    expect(events(log)).not.toContain('consent_shown');
  });
});

describe('단계 시작: course_step_started{step, day_index}', () => {
  test('연결된 기기가 단계에 들어오면 한 번(사진)', async () => {
    const api = createFakeApi({linked: true, consented: true});
    const log = jest.spyOn(api, 'logEvent');
    await toHomeConsented(api);
    await pressCourseNext();
    await waitFor(() => expect(callsOf(log, 'course_step_started')).toEqual([{step: 'photo', day_index: 1}]));
  });

  test('다 마친 뒤 보기 전용(review)에서는 보내지 않는다', async () => {
    const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul']});
    const log = jest.spyOn(api, 'logEvent');
    await toHomeConsented(api);
    await press(/^둘 중 고르기, 했어요, \d+일$/);
    await waitFor(() => screen.getByLabelText('둘 중 고르기, 다시 보는 중'));
    await act(async () => {});
    expect(events(log)).not.toContain('course_step_started');
  });
});

describe('자녀 퍼널', () => {
  test('로그인 성공 → child_signup_completed{login_method}, 취소면 없음', async () => {
    const api = createFakeApi();
    jest.spyOn(api, 'signInWithSocial').mockResolvedValueOnce('cancelled').mockResolvedValueOnce('ok');
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} />);
    await press(/자녀 휴대폰이에요/);
    await waitFor(() => screen.getByTestId('legal-child'));
    await press(/카카오/);
    await act(async () => {});
    expect(events(log)).not.toContain('child_signup_completed');
    await press(/카카오/);
    await waitFor(() => expect(callsOf(log, 'child_signup_completed')).toEqual([{login_method: 'kakao'}]));
  });

  test('이메일 경로(C0-b → C0-c): 틀린 번호면 없음, 맞는 번호로 확인되면 child_signup_completed{login_method: email} 한 번', async () => {
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} />);
    await press(/자녀 휴대폰이에요/);
    await press('이메일로 시작하기');
    await waitFor(() => screen.getByText('이메일로 시작해요'));
    fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
    await press('인증번호 받기');
    await waitFor(() => screen.getByLabelText('인증번호 6자리'));
    fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '000000'); // fake: 틀린 번호
    await waitFor(() => screen.getByText('인증번호가 맞지 않아요. 가장 최근 메일의 번호를 확인해 주세요'));
    expect(events(log)).not.toContain('child_signup_completed');
    fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '246810');
    await waitFor(() => expect(callsOf(log, 'child_signup_completed')).toEqual([{login_method: 'email'}]));
  });

  test('C4 답 카드를 처음 보면 child_first_answer_viewed{days_since_connect} 한 번(답 내용 없음)', async () => {
    const connected = new Date(Date.now() + 9 * 3600e3 - 3 * 86400e3).toISOString().slice(0, 10);
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const api = createFakeApi({
      consented: true,
      parents: [{parentId: 'p1', title: '엄마', connectedDate: connected, latest: {prompt: '봄과 가을', choiceLabel: '봄', answeredDate: today}}],
    });
    const log = jest.spyOn(api, 'logEvent');
    const {unmount} = render(<AppRoot api={api} role="child" />);
    await waitFor(() => expect(callsOf(log, 'child_first_answer_viewed')).toEqual([{days_since_connect: 3}]));
    expect(JSON.stringify(log.mock.calls)).not.toContain('봄');
    unmount();
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await act(async () => {});
    expect(callsOf(log, 'child_first_answer_viewed')).toHaveLength(1);
  });

  test('답이 없으면 child_first_answer_viewed 를 보내지 않는다', async () => {
    const api = createFakeApi({consented: true, parents: [{parentId: 'p1', title: '엄마', latest: null}]});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await act(async () => {});
    expect(events(log)).not.toContain('child_first_answer_viewed');
  });

  test('지난 답 탭 → child_report_viewed', async () => {
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('tab', {name: '지난 날'}));
    expect(events(log)).not.toContain('child_report_viewed');
    await act(async () => {
      fireEvent.press(screen.getByRole('tab', {name: '지난 날'}));
    });
    await waitFor(() => expect(callsOf(log, 'child_report_viewed')).toEqual([undefined]));
  });

  test('응원을 받은 분이 있으면 cheer_sent{message_key} 한 번(받는 분 정보 없음)', async () => {
    jest.useFakeTimers(); // 취소 가능 4초를 실제로 기다리지 않는다(부하 정리 2차)
    const api = createFakeApi({consented: true, parentTitle: '엄마'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
    await press('응원 보내기');
    await press('늘 고마워요');
    await act(async () => {
      jest.advanceTimersByTime(4300); // 취소 가능 시간이 지나야 보낸다
    });
    await waitFor(() => expect(callsOf(log, 'cheer_sent')).toEqual([{message_key: 'thanks_always'}]));
  });

  test('C3 번호 보내기·복사하기 → invite_share_tapped{channel}(번호 값 없음)', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'} as never);
    jest.spyOn(clipboard, 'copyText').mockReturnValue(true);
    const api = createFakeApi({who: 'child', childFamily: true, parentTitle: '엄마'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByTestId('wait-code'), {timeout: 8000});
    await press('번호 보내기');
    await press('복사하기');
    expect(callsOf(log, 'invite_share_tapped')).toEqual([{channel: 'share_sheet'}, {channel: 'copy'}]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('123456');
  });

  test('C1 → 새 번호 → invite_code_issued{purpose:parent_code}', async () => {
    const api = createFakeApi({who: 'child'});
    const log = jest.spyOn(api, 'logEvent');
    render(<AppRoot api={api} restore />);
    await waitFor(() => screen.getByRole('button', {name: '번호 만들기'}));
    await press('번호 만들기');
    await waitFor(() => expect(callsOf(log, 'invite_code_issued')).toEqual([{purpose: 'parent_code'}]));
  });
});

describe('PR #61 리뷰 후속', () => {
  function sbWith(session: object | null) {
    let s = session;
    const rpc = jest.fn(async (name: string, _args?: unknown) => (name === 'log_event' ? {data: {ok: true}, error: null} : {data: null, error: null}));
    const sb = {
      auth: {
        getSession: jest.fn(async () => ({data: {session: s}, error: null})),
        signInAnonymously: jest.fn(async () => ({error: null})),
        signOut: jest.fn(async () => ({error: null})),
      },
      rpc,
    };
    return {sb, rpc, login: () => (s = {user: {id: 'u', app_metadata: {}}})};
  }
  const sentNames = (rpc: jest.Mock) => rpc.mock.calls.filter(c => c[0] === 'log_event').map(c => (c[1] as {p_name: string}).p_name);

  test('L1: 세션 전 보관은 app_first_open 만(다른 이벤트는 버림)', async () => {
    const {sb, rpc, login} = sbWith(null);
    const api = createRealApi(sb as never, undefined, 'android');
    await api.logEvent('consent_shown');
    await api.logEvent('app_first_open', {role_guess: 'child'});
    login();
    await api.logEvent('child_signup_completed', {login_method: 'kakao'});
    expect(sentNames(rpc)).toEqual(['app_first_open', 'child_signup_completed']);
  });

  test('L1: 로그아웃하면 보관한 app_first_open 을 비운다(다음 계정 세션으로 나가지 않음)', async () => {
    const {sb, rpc, login} = sbWith(null);
    const api = createRealApi(sb as never, {signOut: async () => {}, unlinkKakao: async () => {}} as never, 'android');
    await api.logEvent('app_first_open', {role_guess: 'child'});
    await api.signOut().catch(() => {});
    login();
    await api.logEvent('child_signup_completed', {login_method: 'kakao'});
    expect(sentNames(rpc)).toEqual(['child_signup_completed']);
  });

  test('L2: child_first_answer_viewed 는 계정마다 한 번(같은 기기, 다른 계정이면 다시)', async () => {
    const api = createFakeApi();
    let tag = 'acc-a';
    jest.spyOn(api, 'accountTag').mockImplementation(async () => tag);
    const log = jest.spyOn(api, 'logEvent');
    await trackOnce(api, 'child_first_answer_viewed', {days_since_connect: 1});
    await trackOnce(api, 'child_first_answer_viewed', {days_since_connect: 1});
    tag = 'acc-b';
    await trackOnce(api, 'child_first_answer_viewed', {days_since_connect: 2});
    expect(callsOf(log, 'child_first_answer_viewed')).toEqual([{days_since_connect: 1}, {days_since_connect: 2}]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('acc-'); // 가명값은 이벤트에 싣지 않는다
  });

  test('L2: 계정 가명값을 모르면 보내지 않는다', async () => {
    const api = createFakeApi({accountTag: null});
    const log = jest.spyOn(api, 'logEvent');
    await trackOnce(api, 'child_first_answer_viewed', {days_since_connect: 1});
    expect(events(log)).not.toContain('child_first_answer_viewed');
  });

  test('L4: 자녀 첫 답 알림(parent_first_answer) 탭 → push_opened 기록 + 앨범, N3 배너 건너뛰기는 없음', () => {
    const {handleChildPushOpen, takeSkipBanner} = require('../src/features/home/pushOpen');
    const api = createFakeApi();
    const log = jest.spyOn(api, 'logEvent');
    const toAlbum = jest.fn();
    expect(handleChildPushOpen(api, {kind: 'parent_first_answer'}, toAlbum)).toBe('parent_first_answer');
    expect(log).toHaveBeenCalledWith('push_opened', {push_kind: 'parent_first_answer'});
    expect(toAlbum).toHaveBeenCalledTimes(1);
    expect(takeSkipBanner()).toBe(false);
    expect(EVENT_PROP_VALUES.push_kind).toContain('parent_first_answer');
  });
});

describe('daysSinceYmd(KST)', () => {
  const now = new Date('2026-11-19T15:30:00Z'); // KST 11-20 00:30
  test('같은 날 0, 사흘 전 3, 형식 오류·미래는 null', () => {
    expect(daysSinceYmd('2026-11-20', now)).toBe(0);
    expect(daysSinceYmd('2026-11-17', now)).toBe(3);
    expect(daysSinceYmd('2026-11-21', now)).toBeNull();
    expect(daysSinceYmd('11/20', now)).toBeNull();
  });
});
