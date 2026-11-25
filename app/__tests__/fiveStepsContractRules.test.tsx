// 서버 0061 계약 규칙(api/contract/fiveSteps.ts 주석, 리드 #254 ③~⑥)을 화면 흐름으로 고정한다.
// ③ ② 보기 없는 날도 그 단계를 p_skipped:true 로 기록. 4단계(기획 v2.1 Q7·서버 0067): ⑤ 화면도 ⑤ 기록도 없다 — 이 파일의 모든 시험이 끝에서
//   'pass_on 기록 호출 0'을 단언한다(#287 리뷰 L1: 어떤 경로에서도) ④ 넘긴 단계를 다시 하면 기록(p_skipped:false) 먼저, 그다음 저장
// ⑤ 옛 서버(five_steps_supported 없음)면 스위치가 켜져 있어도 3단계 ⑥ 여기까지가 stop_before_question 이면 다시 불러 홈에서 이어 하기(막히지 않음)
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {OfflineError, ServerError} from '../src/features/types';
import {navRef} from '../src/navigation/navRef';
import {copy, offlineMessage} from '../src/copy/copy';
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
let lastRec: jest.SpyInstance | null = null;
afterEach(() => {
  // 4단계(0067): 서버가 ①~④로 완료를 본다 — 앱은 어떤 경로에서도 pass_on 을 기록하지 않는다(#287 대신 기록 제거, 리뷰 L1)
  const passOnCalls = lastRec?.mock.calls.filter(c => c[0] === 'pass_on') ?? [];
  lastRec = null;
  resetFeaturesForTest();
  setPrefsForTest(null);
  expect(passOnCalls).toEqual([]);
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
  lastRec = spies.rec;
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

test('4단계(기획 v2.1 Q7·서버 0067): ④를 마치면 ⑤ 화면 없이 P7 — ④ 기록 한 번에 서버가 완료(도장), ⑤ 기록 없음', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question']});
  const log = jest.spyOn(s.api, 'logEvent');
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰기, 4단계 중 4단계'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(recArgs(s.rec)).toEqual([['hangul', true]]);
  expect(await s.rec.mock.results[0].value).toMatchObject({completed: true});
  expect(s.passOn).not.toHaveBeenCalled();
  expect(screen.queryByTestId('pass-on-title')).toBeNull();
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
  // 계측: 사람이 한 단계만, 완료는 한 번
  expect(log.mock.calls.filter(c => c[0] === 'course_step_completed').map(c => (c[1] as {step: string}).step)).toEqual(['hangul']);
  expect(log.mock.calls.filter(c => c[0] === 'course_completed')).toHaveLength(1);
});

test('4단계: ④ 기록이 끊기면 P7 로 가지 않고 오류 + 다시 하기, 다시 하면 도장(⑤ 기록 없음)', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question']});
  s.rec.mockRejectedValueOnce(new OfflineError('x'));
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText(offlineMessage.title));
  expect(screen.queryByText(/도장을 찍었어요/)).toBeNull();
  await press('다시 하기'); // P6 오류 줄의 다시 하기 = 마지막 동작(넘어가기)을 다시
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(recArgs(s.rec)).toEqual([['hangul', true], ['hangul', true]]);
});

test('0067 전 서버(four_steps_supported 없음): 스위치가 켜져 있어도 3단계 — p_course_len 4 를 보내지 않는다', async () => {
  const s = await home({fourStepsSupported: false});
  const ids = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && /^step-(now-row|wait-)/.test(n.props.testID) && typeof n.type === 'string').map(n => n.props.testID);
  expect([...new Set(ids)]).toEqual(['step-now-row', 'step-wait-question', 'step-wait-hangul']);
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('사진 보기, 3단계 중 1단계'));
  await press('다 봤어요');
  await backHome();
  expect(s.rec.mock.calls).toEqual([['photo', expect.any(Number)]]);
});

test('④ 넘긴 ③을 다시 하면 save_answer 먼저 → 예외 skipped → 기록(p_skipped:false) → 재저장 1회(성공)', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question'], skippedSteps: ['question']});
  await act(async () => {
    navRef.navigate('QuestionStep');
  });
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 4단계 중 3단계'));
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

test('4단계: ③ 뒤 여기까지로 마친 홈에는 ⑤ 행이 없고(서버가 채운 pass_on 은 화면에 안 보임), 넘긴 ④만 다시 할 수 있다', async () => {
  const s = await home({completedSteps: ['photo', 'recall', 'question']});
  await press('오늘은 여기까지 할게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-head'));
  expect(recArgs(s.rec)).toEqual([['stop_here', undefined]]); // 서버가 ④를 채운다(0067: 4로 부르면 ⑤는 없음) — 앱은 ⑤를 기록하지 않는다
  expect(screen.queryByTestId('step-done-pass_on')).toBeNull();
  expect(screen.getByTestId('step-done-hangul').props.accessibilityHint).not.toBe(copy.course.review_row_hint);
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

test('QA-2 L2: 앱을 다시 켠 뒤(서버 skipped_steps 에 ④·⑤) 다 마친 홈에서 넘긴 ④ 행은 다시 할 수 있게 열고, ⑤ 행은 없다', async () => {
  await home({completedSteps: ['photo', 'recall', 'question', 'hangul', 'pass_on'], skippedSteps: ['hangul', 'pass_on']});
  expect(screen.getByTestId('course-done-head')).toBeTruthy();
  expect(screen.queryByTestId('step-done-pass_on')).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-hangul'));
  });
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸')); // 보기 전용이 아니라 입력 칸
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

