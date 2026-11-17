import React from 'react';
import {AppState} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {OfflineError} from '../src/features/types';
import {CONSENT_VERSION} from '../src/copy/copy';
import {press, toHome, toHomeConsented, pressCourseNext} from '../testUtils/flow';

async function previewHome(api: ReturnType<typeof createFakeApi>) {
  render(<AppRoot api={api} role="parent" />);
  await press('코스 보기');
  await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
}

test('미연결 열람: 코스를 끝까지 보되 저장·기록 API 는 부르지 않는다', async () => {
  const api = createFakeApi();
  const save = jest.spyOn(api, 'saveAnswer');
  const rec = jest.spyOn(api, 'recordSessionStep');
  await previewHome(api);
  expect(screen.getByRole('button', {name: '설정'})).toBeTruthy(); // 미연결에도 설정 입구는 보인다(QA B3·시안 P3)
  expect(screen.queryByRole('button', {name: '좋아요'})).toBeNull();
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByLabelText('사진 보기, 했어요'));
  await pressCourseNext();
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 썼어요'}));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  expect(screen.queryByText(/도장을 찍었어요/)).toBeNull(); // 미연결 열람은 기록하지 않으므로 도장 말 없음
  expect(save).not.toHaveBeenCalled();
  expect(rec).not.toHaveBeenCalled();
});

test('미연결 열람: 번호 쓰기로 번호 입력 화면으로 간다', async () => {
  await previewHome(createFakeApi());
  await press('번호 쓰기');
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
});

test('동의는 문구 버전을 함께 보낸다', async () => {
  const api = createFakeApi();
  const give = jest.spyOn(api, 'giveConsent');
  await toHome(api, true);
  expect(CONSENT_VERSION).toBe('v2');
  expect(give).toHaveBeenCalledWith('v2');
});

test('fake 서버도 미동의 저장을 거부한다(consent_required)', async () => {
  const api = createFakeApi();
  await expect(api.saveAnswer({questionId: 'q-1', choice: 'A'})).rejects.toThrow(/consent_required/);
});

test('앱은 동의로 알고 있으나 서버가 거부하면(consent_required) 저장 없이 진행한다', async () => {
  const api = createFakeApi({consented: true});
  const rec = jest.spyOn(api, 'recordSessionStep');
  await toHomeConsented(api);
  await api.withdrawConsent(); // 다른 경로로 서버 동의가 풀린 상황
  const save = jest.spyOn(api, 'saveAnswer');
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByLabelText('사진 보기, 했어요'));
  await pressCourseNext();
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await waitFor(() => expect(rec.mock.calls.map(c => c[0])).toEqual(['photo', 'question']));
  expect(save).toHaveBeenCalledTimes(1);
  await expect(save.mock.results[0].value).rejects.toThrow(/consent_required/);
});

test('설정 입구는 분명한 버튼이다(높이 64 이상)', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  const b = screen.getByRole('button', {name: '설정'});
  const {StyleSheet} = require('react-native');
  expect(StyleSheet.flatten(b.props.style).minHeight).toBeGreaterThanOrEqual(64);
});

test('완료 화면에 연속 일수가 없다', async () => {
  const api = createFakeApi({consented: true, completedSteps: ['photo', 'question', 'hangul'], streak: 5});
  await toHomeConsented(api);
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  expect(screen.getByText('도장을 찍었어요. 내일 또 만나요')).toBeTruthy();
  expect(screen.queryByText(/연속/)).toBeNull();
});

function captureAppState() {
  const handlers: ((st: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (st: string) => void) => {
    handlers.push(h);
    return {remove: () => {}};
  }) as never);
  return async () => {
    await act(async () => {
      handlers.forEach(h => h('active'));
    });
  };
}

test('포그라운드 재조회 실패는 알리고 다시 할 수 있다(코스는 유지)', async () => {
  const fire = captureAppState();
  const api = createFakeApi({consented: true});
  await toHomeConsented(api);
  jest.spyOn(api, 'getTodayContent').mockRejectedValueOnce(new Error('boom'));
  await fire();
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
  expect(screen.getByRole('button', {name: '사진 보기'})).toBeTruthy(); // 코스는 유지(주 버튼 = 지금 단계)
  await press('다시 하기');
  await waitFor(() => expect(screen.queryByText('잠깐 문제가 생겼어요')).toBeNull());
});

test('자녀 홈: 받은 답이 있으면 다시 불러오다 실패해도 답을 유지한다', async () => {
  const fire = captureAppState();
  const api = createFakeApi({consented: true, latest: {prompt: null, choiceLabel: '가을', answeredDate: '2026-11-16'}});
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByText('가을'));
  jest.spyOn(api, 'fetchChildSummary').mockRejectedValueOnce(new OfflineError('x'));
  await fire();
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  expect(screen.getByText('가을')).toBeTruthy();
});

test('동의 화면에서 서버 확인이 실패하면 알리되 고를 수는 있다', async () => {
  const api = createFakeApi();
  render(<AppRoot api={api} role="parent" />);
  jest.spyOn(api, 'getTodayContent').mockRejectedValueOnce(new OfflineError('x'));
  for (const d of '123456') {
    fireEvent.press(screen.getByLabelText(`숫자 ${d}`));
  }
  await press('다음');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  expect(screen.getByRole('button', {name: '좋아요'})).toBeTruthy();
});

test('코스 홈에서 나중 동의가 서버 오류면 그 오류 문구를 보여 준다', async () => {
  const api = createFakeApi();
  jest.spyOn(api, 'giveConsent').mockRejectedValueOnce(new Error('boom'));
  await toHome(api, false);
  await press('좋아요');
  await waitFor(() => screen.getByText('잠깐 문제가 생겼어요'));
});

test('realApi: get_today_content 가 no_profile 이면 preview_content 로 열람 모드', async () => {
  const rpc = jest.fn(async (name: string) => {
    if (name === 'get_today_content') {
      return {data: null, error: {code: 'P0001', message: 'no_profile'}};
    }
    return {
      data: {day_index: 3, photo: {caption: 'c', image_url: 'pending://3', keyword: 'k', recall_questions: []}, question: {id: 'q', option_a: 'a', option_b: 'b', prompt: null}, linked: false},
      error: null,
    };
  });
  const api = createRealApi({rpc, auth: {getSession: async () => ({data: {session: {user: {id: 'u'}}}, error: null})}} as never);
  const c = await api.getTodayContent();
  expect(rpc).toHaveBeenCalledWith('preview_content');
  expect(c).toMatchObject({linked: false, consented: false, completed_steps: [], answered_choice: null});
});

test('realApi: giveConsent 는 p_version 을 보낸다', async () => {
  const rpc = jest.fn().mockResolvedValue({data: null, error: null});
  await createRealApi({rpc} as never).giveConsent('v2');
  expect(rpc).toHaveBeenCalledWith('give_consent', {p_version: 'v2'});
});

test('realApi: 프로필이 있는 자녀는 preview 로 넘어가지 않고 원래 오류(parent_required)를 올린다', async () => {
  const rpc = jest.fn(async (name: string) =>
    name === 'get_today_content'
      ? {data: null, error: {code: 'P0001', message: 'parent_required'}}
      : {data: null, error: {code: 'P0001', message: 'linked_use_get_today_content'}},
  );
  const auth = {getSession: async () => ({data: {session: {user: {id: 'u'}}}, error: null})};
  const api = createRealApi({rpc, auth} as never);
  await expect(api.getTodayContent()).rejects.toThrow(/get_today_content: parent_required/);
});
