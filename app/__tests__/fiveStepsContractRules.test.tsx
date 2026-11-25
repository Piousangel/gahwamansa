// 서버 0061 계약 규칙(api/contract/fiveSteps.ts 주석, 리드 #254 ③~⑥)을 화면 흐름으로 고정한다.
// ③ ② 보기 없는 날·⑤ 꺼진 날도 그 단계를 p_skipped:true 로 기록 ④ 넘긴 단계를 다시 하면 기록(p_skipped:false) 먼저, 그다음 저장
// ⑤ 옛 서버(five_steps_supported 없음)면 스위치가 켜져 있어도 3단계 ⑥ 여기까지가 stop_before_question 이면 다시 불러 홈에서 이어 하기(막히지 않음)
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {ServerError} from '../src/features/types';
import {navRef} from '../src/navigation/navRef';
import {copy} from '../src/copy/copy';
import {press, pressCourseNext} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

setupWarmAppRoot();

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));

beforeEach(async () => {
  setFeature('fiveSteps', true);
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
});

async function home(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, realImage: true, ...opts});
  const spies = {
    rec: jest.spyOn(api, 'recordSessionStep'),
    recall: jest.spyOn(api, 'saveRecall'),
    passOn: jest.spyOn(api, 'savePassOn'),
    answer: jest.spyOn(api, 'saveAnswer'),
    today: jest.spyOn(api, 'getTodayContent'),
  };
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return {api, ...spies};
}
const backHome = () => waitFor(() => screen.getByTestId('date-line'));
const recArgs = (rec: jest.SpyInstance) => rec.mock.calls.map(c => [c[0], c[2]?.skipped]);

test('③ ② 보기가 없는 날: 넘어가기 하나만 → recall 을 p_skipped:true 로 기록(저장 0)', async () => {
  const s = await home({noRecall: true, completedSteps: ['photo']});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  expect(screen.queryByTestId('recall-choice')).toBeNull();
  await press('오늘은 넘어갈게요');
  await backHome();
  expect(recArgs(s.rec)).toEqual([['recall', true]]);
  expect(s.recall).not.toHaveBeenCalled();
});

test('③ ⑤ 서버 스위치가 꺼진 날: 카드를 골라 [건넬게요]여도 저장 0, pass_on 은 p_skipped:true, P7 첫 줄 없음', async () => {
  const s = await home({passOnEnabled: false, completedSteps: ['photo', 'recall', 'question', 'hangul']});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  fireEvent.press(screen.getByText('어느 쪽일지 궁금해요'));
  await press('건넬게요');
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(recArgs(s.rec)).toEqual([['pass_on', true]]);
  expect(s.passOn).not.toHaveBeenCalled();
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
});

test('④ 넘긴 ③을 다시 하면 record_session_step(p_skipped:false) 먼저, 그다음 save_answer(서버는 넘긴 단계 답을 skipped 로 거부)', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question'], skippedSteps: ['question']});
  await act(async () => {
    navRef.navigate('QuestionStep');
  });
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 5단계 중 3단계'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await backHome();
  expect(recArgs(s.rec)).toEqual([['question', false]]);
  expect(s.answer).toHaveBeenCalledTimes(1);
  await expect(s.answer.mock.results[0].value).resolves.toBeUndefined(); // 저장 성공(skipped 예외 없음)
  expect(s.rec.mock.invocationCallOrder[0]).toBeLessThan(s.answer.mock.invocationCallOrder[0]);
});

test('④ ③ 뒤 여기까지로 넘긴 ⑤를 홈에서 다시 하면 기록 먼저 → save_pass_on 성공, P7 은 다시 뜨지 않는다', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question']});
  await press('오늘은 여기까지 할게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-head'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-pass_on'));
  });
  await waitFor(() => screen.getByTestId('pass-on-title'));
  fireEvent.press(screen.getByText('오늘 사진이 좋아요'));
  await press('건넬게요');
  await backHome();
  expect(screen.queryByText('오늘 코스를 마쳤어요')).toBeNull();
  const recPassOn = s.rec.mock.invocationCallOrder[s.rec.mock.calls.findIndex(c => c[0] === 'pass_on')];
  expect(recArgs(s.rec).slice(-1)).toEqual([['pass_on', false]]);
  expect(recPassOn).toBeLessThan(s.passOn.mock.invocationCallOrder[0]);
  expect(await s.passOn.mock.results[0].value).toEqual({ok: true});
});

test('⑤ 옛 서버(five_steps_supported 없음): 스위치가 켜져 있어도 3단계 — 3행, 기록은 옛 2인자', async () => {
  const s = await home({fiveStepsSupported: false});
  const ids = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && /^step-(now-row|wait-)/.test(n.props.testID) && typeof n.type === 'string').map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['step-now-row', 'step-wait-question', 'step-wait-hangul']);
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('사진 보기, 3단계 중 1단계'));
  await press('다 봤어요');
  await backHome();
  expect(s.rec.mock.calls).toEqual([['photo', expect.any(Number)]]);
});

test('⑥ 여기까지가 stop_before_question(자정을 넘겨 새 날)이면 오류 없이 오늘 콘텐츠를 다시 불러 홈에서 이어 한다', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question']});
  s.rec.mockRejectedValueOnce(new ServerError('record_session_step', 'stop_before_question', 'P0001'));
  const before = s.today.mock.calls.length;
  await press('오늘은 여기까지 할게요');
  await backHome();
  await waitFor(() => expect(s.today.mock.calls.length).toBeGreaterThan(before));
  expect(screen.queryByText('오늘 코스를 마쳤어요')).toBeNull();
  expect(screen.queryByText(copy.errors.server.title)).toBeNull();
  expect(screen.queryByTestId('course-stop-error')).toBeNull();
  expect(within(screen.getByTestId('screen-dock')).getByText('낱말 쓰기')).toBeTruthy();
});
