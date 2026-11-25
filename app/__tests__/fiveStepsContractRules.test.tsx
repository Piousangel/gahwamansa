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

test('④ 넘긴 ③을 다시 하면 save_answer 먼저 → 예외 skipped → 기록(p_skipped:false) → 재저장 1회(성공)', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question'], skippedSteps: ['question']});
  await act(async () => {
    navRef.navigate('QuestionStep');
  });
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 5단계 중 3단계'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await backHome();
  expect(recArgs(s.rec)).toEqual([['question', false]]);
  expect(s.answer).toHaveBeenCalledTimes(2);
  await expect(s.answer.mock.results[0].value).rejects.toMatchObject({reason: 'skipped'});
  await expect(s.answer.mock.results[1].value).resolves.toBeUndefined();
  const [a1, a2] = s.answer.mock.invocationCallOrder;
  expect(a1).toBeLessThan(s.rec.mock.invocationCallOrder[0]);
  expect(s.rec.mock.invocationCallOrder[0]).toBeLessThan(a2);
});

test('④ ③ 뒤 여기까지로 넘긴 ⑤를 홈에서 다시 하면 저장 먼저 → skipped → 기록 → 재저장 성공, P7 은 다시 뜨지 않는다', async () => {
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
  expect(recArgs(s.rec).slice(-1)).toEqual([['pass_on', false]]);
  expect(s.passOn).toHaveBeenCalledTimes(2);
  expect(await s.passOn.mock.results[0].value).toEqual({ok: false, reason: 'skipped'});
  expect(await s.passOn.mock.results[1].value).toEqual({ok: true});
  const recPassOn = s.rec.mock.invocationCallOrder[s.rec.mock.calls.findIndex(c => c[0] === 'pass_on' && c[2]?.skipped === false)];
  expect(s.passOn.mock.invocationCallOrder[0]).toBeLessThan(recPassOn);
  expect(recPassOn).toBeLessThan(s.passOn.mock.invocationCallOrder[1]);
});

test('QA-2 L3: 자정을 넘겨 ⑤ 저장이 stale_day 면 record_session_step 호출 0 — 다시 불러 홈으로(새 날 ⑤가 먼저 찍히지 않게)', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question', 'hangul', 'pass_on'], skippedSteps: ['hangul', 'pass_on']});
  s.passOn.mockResolvedValue({ok: false, reason: 'stale_day'});
  const before = s.today.mock.calls.length;
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-pass_on'));
  });
  await waitFor(() => screen.getByTestId('pass-on-title'));
  fireEvent.press(screen.getByText('오늘 사진이 좋아요'));
  await press('건넬게요');
  await backHome();
  expect(s.passOn).toHaveBeenCalledTimes(1);
  expect(s.rec).not.toHaveBeenCalled();
  await waitFor(() => expect(s.today.mock.calls.length).toBeGreaterThan(before));
});

test('QA-2 L3: ② 저장이 stale_day 여도 record_session_step 호출 0', async () => {
  const s = await home({completedSteps: ['photo']});
  s.recall.mockResolvedValue({ok: false, reason: 'stale_day'});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  fireEvent.press(screen.getByText('참새'));
  await press('이걸로 할게요');
  await backHome();
  expect(s.rec).not.toHaveBeenCalled();
});

test('QA-2 L2: 앱을 다시 켠 뒤(서버 skipped_steps 에 ④·⑤) 다 마친 홈에서 넘긴 ④·⑤ 행은 그 단계를 다시 할 수 있게 연다', async () => {
  await home({completedSteps: ['photo', 'recall', 'question', 'hangul', 'pass_on'], skippedSteps: ['hangul', 'pass_on']});
  expect(screen.getByTestId('course-done-head')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-hangul'));
  });
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸')); // 보기 전용이 아니라 입력 칸
  await act(async () => {
    navRef.goBack();
  });
  await backHome();
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-pass_on'));
  });
  await waitFor(() => screen.getByTestId('pass-on-choice')); // 고를 수 있는 카드(보기 전용 아님)
  expect(screen.getByRole('button', {name: '건넬게요'})).toBeTruthy();
  // 넘기지 않은 ②는 보기 전용
  await act(async () => {
    navRef.goBack();
  });
  await backHome();
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-recall'));
  });
  await waitFor(() => screen.getByRole('button', {name: '오늘 코스로'}));
  expect(screen.queryByRole('button', {name: '이걸로 할게요'})).toBeNull();
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

test('QA-1 L3(리드 결정): 앱이 스스로 넘긴 ⑤(서버 스위치 꺼짐)는 다 마친 홈에서 다시 하기로 열지 않는다 — 누르면 보기 전용', async () => {
  await home({passOnEnabled: false, completedSteps: ['photo', 'recall', 'question', 'hangul', 'pass_on'], skippedSteps: ['pass_on']});
  const row = screen.getByTestId('step-done-pass_on');
  expect(row.props.accessibilityHint).toBe(copy.course.review_row_hint); // 다시 보기 힌트(다시 하기 아님)
  await act(async () => {
    fireEvent.press(row);
  });
  await waitFor(() => screen.getByRole('button', {name: '오늘 코스로'}));
  expect(screen.queryByTestId('pass-on-choice')).toBeNull();
  expect(screen.queryByRole('button', {name: '건넬게요'})).toBeNull();
});

test('QA-1 L1: course_completed 는 처음 완료될 때 한 번만 — 다 마친 뒤 넘긴 ④를 다시 해도(서버 completed=true) 다시 보내지 않는다', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question']});
  const log = jest.spyOn(s.api, 'logEvent');
  await press('오늘은 여기까지 할게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-head'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-hangul'));
  });
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await press('오늘은 넘어갈게요');
  await backHome();
  expect(await s.rec.mock.results[s.rec.mock.results.length - 1].value).toMatchObject({completed: true});
  expect(log.mock.calls.filter(c => c[0] === 'course_completed')).toHaveLength(1);
});

test('QA-2 M1: ② save_recall 이 값 거절(consent_required)이면 오류 문구 없이 recall 을 한 번 기록하고 다음으로', async () => {
  const s = await home({completedSteps: ['photo']});
  s.recall.mockResolvedValue({ok: false, reason: 'consent_required'});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  fireEvent.press(screen.getByText('참새'));
  await press('이걸로 할게요');
  await backHome();
  expect(recArgs(s.rec)).toEqual([['recall', false]]);
  expect(screen.queryByText(copy.errors.server.title)).toBeNull();
  expect(within(screen.getByTestId('step-now-row')).getByText('둘 중 고르기')).toBeTruthy();
});

test('QA-2 M1: ⑤ save_pass_on 이 값 거절(consent_required)이면 오류 문구 없이 pass_on 을 한 번 기록하고 P7(첫 줄 없음)', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question', 'hangul']});
  s.passOn.mockResolvedValue({ok: false, reason: 'consent_required'});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  fireEvent.press(screen.getByText('오늘 사진이 좋아요'));
  await press('건넬게요');
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(recArgs(s.rec)).toEqual([['pass_on', false]]);
  expect(screen.queryByText(copy.errors.server.title)).toBeNull();
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
});
