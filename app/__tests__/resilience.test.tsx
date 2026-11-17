import React from 'react';
import {AppState} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {OfflineError, ServerError} from '../src/features/types';
import {createRealApi} from '../src/features/realApi';
import {enterCode, press, toHome, toHomeConsented} from '../testUtils/flow';

test('서버가 이미 동의한 상태면 동의 화면을 건너뛴다', async () => {
  render(<AppRoot api={createFakeApi({consented: true})} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('오늘의 코스'));
});

test('동의 저장이 실패하면 오류 문구를 보여 주고 다시 누를 수 있다', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'giveConsent').mockRejectedValueOnce(new OfflineError('x'));
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고른 답을 가족과 나눠요'));
  await press('좋아요');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('좋아요');
  await waitFor(() => screen.getByText('오늘의 코스'));
});

test('거부한 뒤 코스 홈에서 나중에 동의할 수 있다', async () => {
  const api = createFakeApi();
  const give = jest.spyOn(api, 'giveConsent');
  await toHome(api, false);
  expect(give).not.toHaveBeenCalled();
  await press('좋아요');
  expect(give).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('button', {name: '좋아요'})).toBeNull());
});

test('기록이 실패하면 완료 처리하지 않고 다시 하기를 안내한다', async () => {
  const api = createFakeApi({failRecord: 1, consented: true});
  await toHomeConsented(api);
  await press(/사진 보기/);
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  expect(screen.queryByText('사진 보기 - 했어요')).toBeNull();
  await press('다시 하기');
  await waitFor(() => screen.getByText('사진 보기 - 했어요'));
});

test('소요 시간은 0~7200초 숫자로 보낸다', async () => {
  const api = createFakeApi({consented: true});
  const rec = jest.spyOn(api, 'recordSessionStep');
  await toHomeConsented(api);
  await press(/사진 보기/);
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  const d = rec.mock.calls[0][1];
  expect(d).toBeGreaterThanOrEqual(0);
  expect(d).toBeLessThanOrEqual(7200);
});

async function toQuestion(api: ReturnType<typeof createFakeApi>) {
  await toHomeConsented(api);
  await press(/사진 보기/);
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByText('오늘의 코스'));
  await press(/둘 중 고르기/);
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
}

test('답변 저장이 실패하면 알리고 진행하지 않는다', async () => {
  const api = createFakeApi({consented: true});
  jest.spyOn(api, 'saveAnswer').mockRejectedValueOnce(new Error('save_answer: boom'));
  const rec = jest.spyOn(api, 'recordSessionStep');
  await toQuestion(api);
  await press('정했어요');
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
  expect(rec).toHaveBeenCalledTimes(1); // 사진 단계만
});

test('저장 거부(consent_required)는 저장 없이 진행한다', async () => {
  const api = createFakeApi({consented: true});
  jest.spyOn(api, 'saveAnswer').mockRejectedValueOnce(new ServerError('save_answer', 'consent_required', 'P0001'));
  const rec = jest.spyOn(api, 'recordSessionStep');
  await toQuestion(api);
  await press('정했어요');
  await waitFor(() => expect(rec.mock.calls.map(c => c[0])).toEqual(['photo', 'question']));
});

test('Connect: 오프라인과 기타 오류는 다른 문구', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'redeemInviteCode').mockRejectedValueOnce(new OfflineError('x'));
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  jest.spyOn(api, 'redeemInviteCode').mockRejectedValueOnce(new Error('boom'));
  await enterCode('123456');
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
});

test('already_linked 버튼은 코스로 이동한다', async () => {
  render(<AppRoot api={createFakeApi({consented: true, linked: true})} role="parent" />);
  await enterCode('444444');
  await waitFor(() => screen.getByText('이미 연결돼 있어요'));
  await press('사진 보기');
  await waitFor(() => screen.getByText('오늘의 코스'));
});

test('복원: 연결된 기기는 코스 홈으로 시작하고 완료 단계는 서버 기준', async () => {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo'], streak: 2});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByText('사진 보기 - 했어요'));
});

test('복원: 연결 안 된 기기는 Connect 로 시작', async () => {
  render(<AppRoot api={createFakeApi()} role="parent" restore />);
  await waitFor(() => screen.getByText('안녕하세요, 해님이에요'));
});

test('포그라운드로 돌아오면 서버에서 다시 불러온다', async () => {
  let handler: (s: string) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handler = h;
    return {remove: () => {}};
  }) as never);
  const api = createFakeApi({linked: true, consented: true});
  const spy = jest.spyOn(api, 'getTodayContent');
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByText('오늘의 코스'));
  const before = spy.mock.calls.length;
  await act(async () => {
    handler('active');
  });
  expect(spy.mock.calls.length).toBeGreaterThan(before);
});

test('photo 또는 question 이 null 이면 빈 상태 화면', async () => {
  await toHome(createFakeApi({questionNull: true}));
  await waitFor(() => screen.getByText('오늘 사진을 준비하고 있어요'));
});

test('자녀 홈 조회 실패는 오류 상태이고 다시 불러올 수 있다', async () => {
  render(<AppRoot api={createFakeApi({failChildHome: 1, consented: true, latest: null})} role="child" />);
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('고른 답이 생기면 여기에 보여요'));
});

test('realApi: getSession 오류면 새 익명 로그인을 만들지 않는다', async () => {
  const signIn = jest.fn();
  const sb = {
    auth: {
      getSession: jest.fn().mockResolvedValue({data: {session: null}, error: {message: 'Network request failed'}}),
      signInAnonymously: signIn,
    },
  };
  const api = createRealApi(sb as never);
  await expect(api.redeemInviteCode('123456')).rejects.toBeInstanceOf(OfflineError);
  expect(signIn).not.toHaveBeenCalled();
});
