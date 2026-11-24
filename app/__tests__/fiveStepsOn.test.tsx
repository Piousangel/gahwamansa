// 기능 스위치 fiveSteps 켜짐: 5단계 흐름(DECISIONS 2026-11-25 '3단계 → 5단계'·'5단계 화면 결정'·'5단계 문구 확정',
// 시안 docs/design/2026-11-25-five-steps, 문구 docs/team/copy/2026-11-25-five-steps-copy.md).
// 흐름·넘어가기·여기까지·이어 하기·A′·도장 1개·P7 첫 줄·오늘 한 장·저장 조건(동의·플래그)·200% 배치를 단언한다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {press, pressCourseNext} from '../testUtils/flow';
import {copy} from '../src/copy/copy';
import {ServerError} from '../src/features/types';
import {createFakeTokenSource, setTokenSourceForTest} from '../src/push/tokenSource';
import {setPushTokenStoreForTest} from '../src/lib/pushToken';
import {FIVE_STEPS_NOT_READY} from '../src/api/contract/fiveSteps';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));

beforeEach(async () => {
  setFeature('fiveSteps', true);
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen(); // 첫날 해님 인사가 아닌 보통 날
  setPrefsForTest(p);
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
  mockFontScale = 1;
});

async function home(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, realImage: true, ...opts});
  const spies = {
    rec: jest.spyOn(api, 'recordSessionStep'),
    recall: jest.spyOn(api, 'saveRecallChoice'),
    passOn: jest.spyOn(api, 'savePassOn'),
    answer: jest.spyOn(api, 'saveAnswer'),
  };
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return {api, ...spies};
}
const backHome = () => waitFor(() => screen.getByTestId('date-line'));
const dock = () => within(screen.getByTestId('screen-dock'));
const rowIds = () => [
  ...new Set(
    screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && /^step-(now-row|done-|wait-)/.test(n.props.testID) && typeof n.type === 'string').map(
      n => n.props.testID as string,
    ),
  ),
];

async function doPhoto() {
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('사진 보기, 5단계 중 1단계'));
  await press('다 봤어요');
  await backHome();
}
async function doRecall(word: string | null) {
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  if (word) {
    fireEvent.press(screen.getByText(word));
    await press('이걸로 할게요');
  } else {
    await press('오늘은 넘어갈게요');
  }
  await backHome();
}
async function doQuestion(choice: string | null) {
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 5단계 중 3단계'));
  if (choice) {
    fireEvent.press(screen.getByText(choice));
    await press('정했어요');
  } else {
    await press('오늘은 넘어갈게요');
  }
  await backHome();
}
async function doHangul(text: string | null) {
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  if (text) {
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('낱말 쓰는 칸'), text);
    });
    await act(async () => new Promise<void>(r => setTimeout(() => r(), 1600)));
    await press('마칠게요');
  } else {
    await press('오늘은 넘어갈게요');
  }
  await backHome();
}

test('코스 홈 5행(사진 보기 → 떠올려 보기 → 둘 중 고르기 → 낱말 쓰기 → 이야기 건네기), A′: 다음 행은 이름만·읽기 "{단계}, 5단계 중 {n}단계"', async () => {
  await home();
  expect(rowIds()).toEqual(['step-now-row', 'step-wait-recall', 'step-wait-question', 'step-wait-hangul', 'step-wait-pass_on']);
  expect(screen.queryByText('다음 차례')).toBeNull();
  expect(screen.getByLabelText('떠올려 보기, 5단계 중 2단계')).toBeTruthy();
  expect(screen.getByLabelText('이야기 건네기, 5단계 중 5단계')).toBeTruthy();
  expect(screen.queryByText(/남았어요/)).toBeNull();
  expect(screen.queryByText('오늘은 여기까지 할게요')).toBeNull(); // ③ 전에는 없다
});

test('끝까지 고르기: ② 고른 낱말이 ④ 본보기·⑤ 첫 카드로, 저장은 동의 조건대로, P7 첫 줄 「가족에게 건넸어요」, 다 마치면 제목 옆 도장 1개', async () => {
  const s = await home();
  await doPhoto();
  // ② 떠올려 보기: 사진 80 + AI 고지, 질문, 정답은 없어요, 보기 3장(라이터 CSV 1일), Dock [이걸로 할게요] + 넘어가기
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  expect(screen.getByText('떠올려 보기 · 2 / 5')).toBeTruthy();
  expect(screen.getByTestId('five-photo')).toBeTruthy();
  expect(within(screen.getByTestId('five-photo')).getByText('AI가 만든 그림·실제 장소가 아니에요')).toBeTruthy();
  expect(screen.getByText('이 사진을 보면 무엇이 먼저 떠오르세요?')).toBeTruthy();
  expect(screen.getByText('정답은 없어요')).toBeTruthy();
  expect(['그늘', '참새', '산들바람'].map(w => !!screen.getByRole('radio', {name: w}))).toEqual([true, true, true]);
  expect(dock().getByRole('button', {name: '오늘은 넘어갈게요'})).toBeTruthy();
  fireEvent.press(screen.getByText('참새'));
  expect(screen.getByText('골랐어요', {includeHiddenElements: true})).toBeTruthy(); // ✓ 표시(읽기는 radio 선택 상태가 맡음)
  await press('이걸로 할게요');
  await backHome();
  expect(s.recall).toHaveBeenCalledWith(2);
  await doQuestion('봄');
  // ③ 뒤: '오늘은 여기까지 할게요'(100%는 Dock 주 버튼 아래)
  expect(dock().getByRole('button', {name: '오늘은 여기까지 할게요'})).toBeTruthy();
  // ④ 낱말 쓰기: ②에서 고른 낱말
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  expect(screen.getByText('낱말 쓰기 · 4 / 5')).toBeTruthy();
  expect(screen.getByText('떠올리신 낱말을 아래 칸에 써요')).toBeTruthy();
  expect(screen.getByLabelText('따라 쓸 낱말, 참새')).toBeTruthy();
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('낱말 쓰는 칸'), '참새');
  });
  await act(async () => new Promise<void>(r => setTimeout(() => r(), 1600)));
  await press('마칠게요');
  await backHome(); // ⑤가 남아 P7 이 아니라 코스 홈
  // ⑤ 이야기 건네기: 카드 3장
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  expect(screen.getByText('이야기 건네기 · 5 / 5')).toBeTruthy();
  expect(screen.getByText('가족에게 건넬 한 줄을 골라요')).toBeTruthy();
  const cards = within(screen.getByTestId('pass-on-choice'));
  expect(cards.getAllByRole('radio').map(n => n.props.accessibilityLabel)).toEqual(['참새 얘기할게요', '봄, 그게 좋아요', '어느 쪽일지 궁금해요']);
  expect(cards.getByText('봄 · 가을')).toBeTruthy();
  fireEvent.press(screen.getByText('참새 얘기할게요'));
  await press('건넬게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await waitFor(() => screen.getByText(/^가족에게 건넸어요 /) /* 첫 줄(줄바꿈은 찾기에서 공백) */);
  expect(s.passOn).toHaveBeenCalledWith('recall_story');
  expect(s.answer).toHaveBeenCalledWith({questionId: 'q-1', choice: 'A'});
  expect(s.rec.mock.calls.map(c => c[0])).toEqual(['photo', 'recall', 'question', 'hangul', 'pass_on']);
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-head'));
  expect(screen.getAllByTestId('done-title-stamp', {includeHiddenElements: true})).toHaveLength(1);
  expect(screen.queryByTestId('done-stamp', {includeHiddenElements: true})).toBeNull(); // 행마다 도장 없음
  expect(rowIds()).toEqual(['step-done-photo', 'step-done-recall', 'step-done-question', 'step-done-hangul', 'step-done-pass_on']);
  // 오늘 한 장: '먼저 떠올리신 것'이 '오늘 낱말'을 대신, 맨 아래 '건넨 말'
  await press('오늘 코스 다시 보기');
  await waitFor(() => screen.getByTestId('today-review'));
  expect(within(screen.getByTestId('review-recall')).getByText('먼저 떠올리신 것')).toBeTruthy();
  expect(within(screen.getByTestId('review-recall')).getByText('참새')).toBeTruthy();
  expect(screen.queryByText('오늘 낱말')).toBeNull();
  expect(within(screen.getByTestId('review-pass-on')).getByText('건넨 말')).toBeTruthy();
  expect(within(screen.getByTestId('review-pass-on')).getByText('참새 얘기할게요')).toBeTruthy();
});

test('모두 넘어가기: 넘김도 "했어요", ④는 사진 낱말, ⑤는 대신 문장 3장, 저장 0, P7 에 「가족에게 건넸어요」 없음', async () => {
  const s = await home();
  await doPhoto();
  await doRecall(null);
  await doQuestion(null);
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
  expect(screen.getByLabelText('따라 쓸 낱말, 나무')).toBeTruthy();
  await press('오늘은 넘어갈게요');
  await backHome();
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  expect(within(screen.getByTestId('pass-on-choice')).getAllByRole('radio').map(n => n.props.accessibilityLabel)).toEqual([
    '사진 보니 옛 생각 나요',
    '오늘 사진이 좋아요',
    '어느 쪽일지 궁금해요',
  ]);
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
  expect(s.rec.mock.calls.map(c => c[0])).toEqual(['photo', 'recall', 'question', 'hangul', 'pass_on']);
  expect(s.recall).not.toHaveBeenCalled();
  expect(s.answer).not.toHaveBeenCalled();
  expect(s.passOn).not.toHaveBeenCalled();
  await press('알겠어요');
  await press('오늘 코스 다시 보기');
  await waitFor(() => screen.getByTestId('today-review'));
  expect(screen.getByText('오늘 낱말')).toBeTruthy(); // ②를 넘긴 날은 지금처럼
  expect(screen.queryByText('먼저 떠올리신 것')).toBeNull();
  expect(screen.queryByText('건넨 말')).toBeNull();
});

test('③ 뒤 "오늘은 여기까지 할게요": 확인 대화상자 없이 남은 ④·⑤를 넘어감으로 기록 → P7(몇 단계 했는지 말하지 않음) → 넘긴 ④는 홈에서 다시 할 수 있다', async () => {
  const s = await home();
  await doPhoto();
  await doRecall('그늘');
  await doQuestion('가을');
  await press('오늘은 여기까지 할게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  expect(screen.queryByTestId('dialog')).toBeNull();
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
  expect(screen.queryByText(/단계/)).toBeNull();
  expect(s.rec.mock.calls.map(c => c[0])).toEqual(['photo', 'recall', 'question', 'hangul', 'pass_on']);
  expect(s.passOn).not.toHaveBeenCalled();
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-head'));
  // 넘긴 ④ 행: 보기 전용이 아니라 그 단계를 연다(본보기 = ②에서 고른 '그늘')
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-hangul'));
  });
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  expect(screen.getByLabelText('따라 쓸 낱말, 그늘')).toBeTruthy();
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('낱말 쓰는 칸'), '그늘');
  });
  await act(async () => new Promise<void>(r => setTimeout(() => r(), 1600)));
  await press('마칠게요');
  await backHome(); // 다시 한 뒤에는 P7 을 다시 보이지 않는다
  expect(screen.queryByText('오늘 코스를 마쳤어요')).toBeNull();
  // 넘기지 않은 ②는 보기 전용(다시 보기)
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-recall'));
  });
  await waitFor(() => screen.getByTestId('five-review-1'));
  expect(screen.getByLabelText('고른 답, 그늘')).toBeTruthy();
  expect(screen.queryByRole('button', {name: '이걸로 할게요'})).toBeNull();
});

test('이어 하기: 앱이 꺼져도 하던 단계부터(서버 기록) — 지금 행 = 다음 단계, ④는 서버에 저장된 ② 낱말', async () => {
  await home({completedSteps: ['photo', 'recall'], recallChoice: 3});
  expect(rowIds()).toEqual(['step-done-photo', 'step-done-recall', 'step-now-row', 'step-wait-hangul', 'step-wait-pass_on']);
  expect(within(screen.getByTestId('step-now-row')).getByText('둘 중 고르기')).toBeTruthy();
  await doQuestion('봄');
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  expect(screen.getByLabelText('따라 쓸 낱말, 산들바람')).toBeTruthy();
});

test('동의 안 함: ②·③·⑤ 저장 호출 0, 그래도 ④·⑤는 화면에서 고른 값을 쓰고, P7 첫 줄은 없다(가족에게 안 보임)', async () => {
  const s = await home({consented: false});
  await doPhoto();
  await doRecall('산들바람');
  await doQuestion('가을');
  await doHangul('산들바람');
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  expect(screen.getByText('산들바람 얘기할게요')).toBeTruthy();
  expect(screen.getByText('가을, 그게 좋아요')).toBeTruthy();
  fireEvent.press(screen.getByText('가을, 그게 좋아요'));
  await press('건넬게요');
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
  expect(s.recall).not.toHaveBeenCalled();
  expect(s.answer).not.toHaveBeenCalled();
  expect(s.passOn).not.toHaveBeenCalled();
});

test('QA-2 H1: ③ 보기를 누른 뒤 넘어가기 → 기록 끊김 → [다시 하기]도 넘어가기(답 저장 0 — 넘긴 날 자녀에게 무표시)', async () => {
  const s = await home({completedSteps: ['photo', 'recall'], failRecord: 1});
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 5단계 중 3단계'));
  fireEvent.press(screen.getByText('봄'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText(copy.errors.offline.title));
  await press(copy.errors.offline.button);
  await backHome();
  expect(s.answer).not.toHaveBeenCalled();
  expect(s.rec.mock.calls.map(c => c[0])).toEqual(['question', 'question']);
});

test('QA-2 H1: 보기를 고르지 않고 넘어가기 → 끊김 → [다시 하기]가 동작한다', async () => {
  const s = await home({completedSteps: ['photo', 'recall'], failRecord: 1});
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('둘 중 고르기, 5단계 중 3단계'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText(copy.errors.offline.title));
  await press(copy.errors.offline.button);
  await backHome();
  expect(s.answer).not.toHaveBeenCalled();
  expect(s.rec).toHaveBeenCalledTimes(2);
});

test('QA-2 M1 방어: 서버가 새 단계를 거절(invalid_step)하고 ② 저장이 not_ready 여도 화면은 다음 단계로(저장 없음, 경고만)', async () => {
  const api = createFakeApi({linked: true, consented: true, realImage: true, completedSteps: ['photo']});
  const orig = api.recordSessionStep.bind(api);
  jest.spyOn(api, 'recordSessionStep').mockImplementation(async (step, sec) => {
    if (step === 'recall' || step === 'pass_on') {
      throw new ServerError('record_session_step', 'invalid_step', 'P0001');
    }
    return orig(step, sec);
  });
  jest.spyOn(api, 'saveRecallChoice').mockRejectedValue(new ServerError('save_recall_choice', FIVE_STEPS_NOT_READY));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<AppRoot api={api} role="parent" restore />);
  await backHome();
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  fireEvent.press(screen.getByText('참새'));
  await press('이걸로 할게요');
  await backHome();
  expect(within(screen.getByTestId('step-now-row')).getByText('둘 중 고르기')).toBeTruthy();
  expect(screen.queryByText(copy.errors.server.title)).toBeNull();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test('QA-2 M2: 켜짐 첫날 인사는 「하나씩 차례로 해요」(남은 수 세기 없음)', async () => {
  setPrefsForTest(createPrefs(memoryStore())); // 첫 인사를 아직 안 본 기기
  await home();
  expect(screen.getByTestId('first-greeting').props.accessibilityLabel).toBe('안녕하세요, 해님이에요, 하나씩 차례로 해요');
  expect(screen.queryByText(/세 가지/)).toBeNull();
  expect(screen.getByTestId('step-wait-pass_on')).toBeTruthy();
});

test('QA-2 L1: ⑤ 다시 보기는 화면에서 고른 카드도 표시(②와 같게 — 저장 안 된 날도)', async () => {
  await home({consented: false, completedSteps: ['photo', 'recall', 'question', 'hangul']});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  fireEvent.press(screen.getByText('오늘 사진이 좋아요'));
  await press('건넬게요');
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('course-done-head'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('step-done-pass_on'));
  });
  await waitFor(() => screen.getByTestId('five-review-photo_like'));
  expect(screen.getByLabelText('고른 답, 오늘 사진이 좋아요')).toBeTruthy();
});

test('QA-2 L4: ②·⑤ 보기 묶음(radiogroup)은 질문·제목으로 읽힌다', async () => {
  await home({completedSteps: ['photo']});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-choice'));
  expect(screen.getByTestId('recall-choice').props.accessibilityRole).toBe('radiogroup');
  expect(screen.getByTestId('recall-choice').props.accessibilityLabel).toBe('이 사진을 보면 무엇이 먼저 떠오르세요?');
  await press('오늘은 넘어갈게요');
  await backHome();
  await doQuestion(null);
  await doHangul(null);
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-choice'));
  expect(screen.getByTestId('pass-on-choice').props.accessibilityLabel).toBe('가족에게 건넬 한 줄을 골라요');
});

test('QA-1 L1: 켜짐에서 일일 알림을 열면 5단계 순서의 다음 단계(① 뒤 = ② 떠올려 보기)로', async () => {
  const src = createFakeTokenSource();
  setTokenSourceForTest(src);
  setPushTokenStoreForTest(memoryStore());
  try {
    await home({completedSteps: ['photo']});
    await act(async () => {
      src.emitOpen({kind: 'daily'});
    });
    await waitFor(() => screen.getByTestId('recall-question'));
  } finally {
    setTokenSourceForTest(null);
  }
});

test('⑤ 서버 플래그 꺼짐: 건네도 저장하지 않고 P7 첫 줄도 없다', async () => {
  const s = await home({passOnEnabled: false, completedSteps: ['photo', 'recall', 'question', 'hangul']});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('pass-on-title'));
  fireEvent.press(screen.getByText('어느 쪽일지 궁금해요'));
  await press('건넬게요');
  await waitFor(() => screen.getByText(/도장을 찍었어요/));
  expect(s.passOn).not.toHaveBeenCalled();
  expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
});

test('② 저장이 끊기면 알리고 멈춘다(단계 기록 0) → 다시 하기로 저장·진행', async () => {
  const s = await home({completedSteps: ['photo'], failFiveSave: 1});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('recall-question'));
  fireEvent.press(screen.getByText('그늘'));
  await press('이걸로 할게요');
  await waitFor(() => screen.getByText(copy.errors.offline.title));
  expect(s.rec).not.toHaveBeenCalled();
  await press(copy.errors.offline.button);
  await backHome();
  expect(s.recall).toHaveBeenLastCalledWith(1);
  expect(s.rec.mock.calls.map(c => c[0])).toEqual(['recall']);
});

describe('200%', () => {
  beforeEach(() => {
    mockFontScale = 2;
  });
  test('② 넘어가기는 Dock 이 아니라 카드 아래 본문, "골랐어요"는 낱말 아래 줄, 단계 표시는 "2 / 5"', async () => {
    await home({completedSteps: ['photo']});
    await pressCourseNext();
    await waitFor(() => screen.getByTestId('recall-question'));
    expect(screen.getByText('2 / 5')).toBeTruthy();
    expect(dock().queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
    const body = screen.getByTestId('recall-body');
    expect(within(body).getByRole('button', {name: '오늘은 넘어갈게요'})).toBeTruthy();
    // 넘어가기는 카드 묶음 다음
    const ids = screen.UNSAFE_root.findAll(n => ['recall-choice', 'five-skip-inline'].includes(n.props?.testID) && typeof n.type === 'string').map(n => n.props.testID);
    expect([...new Set(ids)]).toEqual(['recall-choice', 'five-skip-inline']);
    fireEvent.press(screen.getByText('참새'));
    const row = screen.getByTestId('recall-choice-2');
    const textBox = row.findAll(n => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.flexBasis === '100%');
    expect(textBox.length).toBeGreaterThan(0); // 낱말 칸이 한 줄을 다 차지 → ✓ 골랐어요는 다음 줄
  });
  test('코스 홈: "오늘은 여기까지 할게요"는 단계 행 바로 아래 본문(Dock 아님)', async () => {
    await home({completedSteps: ['photo', 'recall', 'question']});
    expect(dock().queryByRole('button', {name: '오늘은 여기까지 할게요'})).toBeNull();
    expect(within(screen.getByTestId('course-steps')).getByRole('button', {name: '오늘은 여기까지 할게요'})).toBeTruthy();
    const keys = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && /^course-steps:/.test(n.props.testID) && typeof n.type === 'string').map(n => n.props.testID);
    const order = [...new Set(keys)];
    expect(order.indexOf('course-steps:stop')).toBe(order.indexOf('course-steps:pass_on') + 1);
  });
  test('③ 넘어가기도 본문', async () => {
    await home({completedSteps: ['photo', 'recall']});
    await pressCourseNext();
    await waitFor(() => screen.getByLabelText('둘 중 고르기, 5단계 중 3단계'));
    expect(dock().queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
    expect(screen.getByTestId('five-skip-inline')).toBeTruthy();
  });
  test('⑤ 넘어가기는 본문, "골랐어요"는 늘 문장 아래 줄', async () => {
    await home({completedSteps: ['photo', 'recall', 'question', 'hangul']});
    await pressCourseNext();
    await waitFor(() => screen.getByTestId('pass-on-title'));
    expect(screen.getByText('5 / 5')).toBeTruthy();
    expect(dock().queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
    expect(within(screen.getByTestId('pass-on-body')).getByTestId('five-skip-inline')).toBeTruthy();
    const row = screen.getByTestId('pass-on-choice-ask_which');
    expect(row.findAll(n => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.flexBasis === '100%').length).toBeGreaterThan(0);
  });
});
