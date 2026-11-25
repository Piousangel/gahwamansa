// 기능 스위치 fiveSteps 꺼짐(기본) = 지금 3단계가 한 줄도 바뀌지 않는다(DECISIONS 2026-11-25 '3단계 → 5단계', 5단계 앱 레인 과제).
// 스냅샷이 아니라 단계 목록·흐름·호출로 단언한다: 3행·이름·'다음 차례'·단계 표시 n/3·기록 순서·저장 호출·P7·오늘 한 장·알림 열기 순서.
import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {FEATURE_DEFAULTS, isFeatureOn, resetFeaturesForTest} from '../src/lib/features';
import {parentStepAfterOpen} from '../src/push/openRoute';
import {press, pressCourseNext} from '../testUtils/flow';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';

// 첫날 해님 인사(다음 행 이름만)가 아닌 보통 날로 본다
beforeEach(async () => {
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
  };
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return {api, ...spies};
}

const rowIds = () =>
  screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && /^step-(now-row|done-|wait-)/.test(n.props.testID) && typeof n.type === 'string').map(n => n.props.testID as string);

test('스위치는 기본 꺼짐이다', () => {
  expect(FEATURE_DEFAULTS.fiveSteps).toBe(false);
  expect(isFeatureOn('fiveSteps')).toBe(false);
});

test('꺼짐: 코스 홈은 3행(사진 보기·둘 중 고르기·낱말 쓰기), 다음 행은 "다음 차례", 5단계 말은 어디에도 없다', async () => {
  await home();
  expect([...new Set(rowIds())]).toEqual(['step-now-row', 'step-wait-question', 'step-wait-hangul']);
  const list = within(screen.getByTestId('course-steps'));
  expect(list.getByText('사진 보기')).toBeTruthy();
  expect(list.getByText('둘 중 고르기')).toBeTruthy();
  expect(list.getByText('낱말 쓰기')).toBeTruthy();
  expect(screen.getAllByText('다음 차례')).toHaveLength(2);
  expect(screen.getByLabelText('둘 중 고르기, 다음 차례')).toBeTruthy();
  for (const t of ['떠올려 보기', '이야기 건네기', '오늘은 여기까지 할게요']) {
    expect(screen.queryByText(t)).toBeNull();
  }
});

test('꺼짐: 서버(0061)가 5단계 칸을 줘도 3단계 — 코스 홈 3행', async () => {
  const s = await home();
  expect((await s.api.getTodayContent())?.five_steps_supported).toBe(true); // fake = 새 서버
  expect([...new Set(rowIds())]).toEqual(['step-now-row', 'step-wait-question', 'step-wait-hangul']);
});

test('꺼짐: 사진 → 고르기 → 낱말 → P7 흐름, 단계 표시 n / 3, 기록 순서·저장 호출 그대로, ②·⑤ 저장 0', async () => {
  const s = await home();
  await pressCourseNext();
  // 단계 표시: 읽기(stepA11y)로 단언 — 글자는 배율에 따라 '사진 보기 · 1 / 3' 또는 '1 / 3'
  await waitFor(() => screen.getByLabelText('사진 보기, 3단계 중 1단계'));
  await press('다 봤어요');
  await waitFor(() => screen.getByTestId('date-line'));
  // ③ 뒤가 아니라 ① 뒤: 다음은 둘 중 고르기, '오늘은 여기까지'는 3단계에 없다
  expect(within(screen.getByTestId('screen-dock')).getByText('둘 중 고르기')).toBeTruthy();
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 3단계 중 2단계'));
  expect(screen.queryByText('오늘은 넘어갈게요')).toBeNull(); // P5 넘어가기는 5단계에서만
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await waitFor(() => screen.getByTestId('date-line'));
  expect(screen.queryByText('오늘은 여기까지 할게요')).toBeNull();
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰기, 3단계 중 3단계'));
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('낱말 쓰는 칸'), '나무');
  });
  await act(async () => new Promise<void>(r => setTimeout(() => r(), 1600)));
  await press('마칠게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
  expect(s.rec.mock.calls.map(c => c[0])).toEqual(['photo', 'question', 'hangul']);
  expect(s.rec.mock.calls.every(c => c.length === 2)).toBe(true); // 옛 2인자 호출 그대로(넘어감·과정 길이 없음)
  expect(await s.rec.mock.results[2].value).toMatchObject({completed: true});
  expect(s.answer).toHaveBeenCalledWith({questionId: 'q-1', choice: 'A'});
  expect(s.recall).not.toHaveBeenCalled();
  expect(s.passOn).not.toHaveBeenCalled();
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-title'));
  // 다 마침: 행마다 날짜 도장(D-2) 3개, 제목 옆 도장은 없다
  expect(screen.getAllByTestId('done-stamp', {includeHiddenElements: true})).toHaveLength(3);
  expect(screen.queryByTestId('done-title-stamp', {includeHiddenElements: true})).toBeNull();
});

test('꺼짐: 오늘 한 장은 "오늘 낱말"(사진 낱말), "먼저 떠올리신 것"·"건넨 말" 줄이 없다', async () => {
  await home({completedSteps: ['photo', 'question', 'hangul'], answeredChoice: 'A'});
  await press('오늘 코스 다시 보기');
  await waitFor(() => screen.getByTestId('today-review'));
  expect(screen.getByText('오늘 낱말')).toBeTruthy();
  expect(screen.getByText('나무')).toBeTruthy();
  expect(screen.queryByText('먼저 떠올리신 것')).toBeNull();
  expect(screen.queryByText('건넨 말')).toBeNull();
});

test('QA-1 M1 꺼짐: 기록에 5단계 이름(recall)이 섞여 있어도 옛 3단계 기준 — 다 마침 제목과 다음 단계 버튼이 함께 나오지 않는다', async () => {
  await home({completedSteps: ['photo', 'recall', 'question']});
  expect(screen.queryByTestId('course-done-title')).toBeNull();
  expect(within(screen.getByTestId('screen-dock')).getByText('낱말 쓰기')).toBeTruthy();
  expect(screen.queryByTestId('step-wait-recall')).toBeNull();
});

test('꺼짐: 알림 열기 순서는 3단계(사진 → 고르기 → 낱말)', () => {
  const c = (done: ('photo' | 'question' | 'hangul')[]) => ({photo: {}, question: {}, completed_steps: done});
  expect(parentStepAfterOpen('daily', c([]))).toBe('PhotoStep');
  expect(parentStepAfterOpen('daily', c(['photo']))).toBe('QuestionStep');
  expect(parentStepAfterOpen('daily', c(['photo', 'question']))).toBe('KeyboardStep');
  expect(parentStepAfterOpen('daily', c(['photo', 'question', 'hangul']))).toBeNull();
});
