import React from 'react';
import {AppState} from 'react-native';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {isServerError, OfflineError, ServerError} from '../src/features/types';
import {press, pressCourseNext} from '../testUtils/flow';

const preview = {
  day_index: 1,
  photo: {caption: 'c', image_url: 'pending://1', keyword: 'k', recall_questions: []},
  question: {id: 'q', option_a: 'a', option_b: 'b', prompt: null},
  linked: false,
};

function fakeSb(opts: {session: boolean; sessionError?: boolean; rpc: (name: string) => unknown}) {
  const calls: string[] = [];
  let session = opts.session;
  return {
    calls,
    sb: {
      auth: {
        getSession: async () => {
          calls.push('getSession');
          return opts.sessionError
            ? {data: {session: null}, error: {message: 'Network request failed'}}
            : {data: {session: session ? {user: {id: 'u'}} : null}, error: null};
        },
        signInAnonymously: async () => {
          calls.push('signInAnonymously');
          session = true;
          return {error: null};
        },
      },
      rpc: async (name: string) => {
        calls.push(name);
        return opts.rpc(name);
      },
    },
  };
}

test('realApi: 세션 없는 첫 실행은 익명 로그인 후 열람한다', async () => {
  const {sb, calls} = fakeSb({
    session: false,
    rpc: n =>
      n === 'get_today_content'
        ? {data: null, error: {code: 'P0001', message: 'parent_required'}}
        : {data: preview, error: null},
  });
  const c = await createRealApi(sb as never).getTodayContent();
  expect(calls.indexOf('signInAnonymously')).toBeGreaterThanOrEqual(0);
  expect(calls.indexOf('signInAnonymously')).toBeLessThan(calls.indexOf('get_today_content'));
  expect(c?.linked).toBe(false);
});

test('realApi: 세션을 못 읽으면(오프라인) 새 익명 사용자를 만들지 않는다', async () => {
  const {sb, calls} = fakeSb({session: false, sessionError: true, rpc: () => ({data: null, error: null})});
  await expect(createRealApi(sb as never).getTodayContent()).rejects.toBeInstanceOf(OfflineError);
  expect(calls).not.toContain('signInAnonymously');
});

test('realApi: 권한 거부(42501)는 오프라인이 아니라 서버 오류', async () => {
  const {sb} = fakeSb({
    session: true,
    rpc: () => ({data: null, error: {code: '42501', message: 'permission denied for function get_today_content'}}),
  });
  const e = await createRealApi(sb as never).getTodayContent().catch(x => x);
  expect(e).toBeInstanceOf(ServerError);
  expect(e).not.toBeInstanceOf(OfflineError);
  expect(e.code).toBe('42501');
});

test('realApi: 서버 예외는 코드(P0001)와 이름이 정확히 같을 때만 그 예외로 본다', async () => {
  const {sb, calls} = fakeSb({
    session: true,
    rpc: () => ({data: null, error: {code: 'P0001', message: 'not_parent_required_but_similar'}}),
  });
  const e = await createRealApi(sb as never).getTodayContent().catch(x => x);
  expect(calls).not.toContain('preview_content');
  expect(isServerError(e, 'parent_required')).toBe(false);
});

test('코스 홈: 서버 오류는 인터넷 끊김이 아니라 서버 오류 문구', async () => {
  const api = createFakeApi({linked: true, consented: true});
  jest.spyOn(api, 'getTodayContent').mockRejectedValueOnce(new ServerError('get_today_content', 'boom', '42501'));
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
  expect(screen.queryByText('인터넷이 잠깐 끊겼어요')).toBeNull();
  await press('다시 하기');
  await waitFor(() => screen.getByTestId('date-line'));
  expect(screen.queryByText('잠깐 문제가 생겼어요')).toBeNull();
});

test('코스 홈: 오프라인이면 인터넷 끊김 문구', async () => {
  const api = createFakeApi({linked: true, consented: true});
  jest.spyOn(api, 'getTodayContent').mockRejectedValueOnce(new OfflineError('x'));
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
});

test('미연결 열람 중 포그라운드 재조회는 화면에서 한 단계를 지우지 않는다', async () => {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handlers.push(h);
    return {remove: () => {}};
  }) as never);
  render(<AppRoot api={createFakeApi()} role="parent" />);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 답이 저장돼요'));
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByLabelText('사진 보기, 했어요'));
  await act(async () => {
    handlers.forEach(h => h('active'));
  });
  expect(screen.getByLabelText('사진 보기, 했어요')).toBeTruthy();
});
