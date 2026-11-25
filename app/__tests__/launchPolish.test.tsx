// 비공개 테스트 시작 빌드(12/06) 다듬기 — DECISIONS 11-25 '오늘 코스 3단계 → 5단계' R-2, docs/team/board/2026-11-25-course-five-steps.md.
// 데이터·서버 변경 없음: ① 회상 질문은 첫 질문만(콘텐츠의 recall_questions 는 그대로 2개), ③ 머리줄 「요즘 생각대로 한쪽을 골라요」,
// 코스 홈 인사 「하나씩 차례로 해요」, 남은 수 문구('둘 남았어요'·'하나 남았어요') 없음.
import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {createAudio, type TtsEngine} from '../src/audio/audioCore';
import {setAudioForTest} from '../src/audio/instance';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {createLocalStamps, setLocalStampsForTest} from '../src/lib/localStamps';
import {press, pressCourseNext} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

// 글자 100%(인사 둘째 줄이 카드 안에 있는 배율)
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: 1}),
}));

const speak = jest.fn(async () => {});
const tts: TtsEngine = {
  hasKorean: async () => true,
  speak,
  stop: async () => {},
  onStart: () => () => {},
  onDone: () => () => {},
};

beforeEach(() => {
  setAudioForTest(createAudio({tts, loadSfx: () => null}));
  setPrefsForTest(createPrefs(memoryStore()));
  setLocalStampsForTest(createLocalStamps(memoryStore()));
});
afterEach(() => {
  setAudioForTest(null);
  setPrefsForTest(null);
  setLocalStampsForTest(null);
  (AccessibilityInfo.isScreenReaderEnabled as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

async function home(opts: FakeOptions = {}) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

// 화면 글(Text) 순서(위 → 아래). texts 중 화면에 있는 것만 처음 나온 순서로
function textOrder(texts: string[]): string[] {
  const all = screen.UNSAFE_root.findAll(n => (n.type as unknown) === 'Text' && texts.includes([n.props.children].flat().join('')));
  return [...new Set(all.map(n => [n.props.children].flat().join('')))];
}

// 본문에서 testID 순서(위 → 아래)
function order(ids: string[]): string[] {
  const all = screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && ids.includes(n.props.testID) && typeof n.type === 'string');
  return [...new Set(all.map(n => n.props.testID as string))];
}

test('① 사진 보기: 회상 질문은 첫 질문 1개만 보이고, 읽어 주기도 그 1개만 읽는다(콘텐츠는 2개 그대로)', async () => {
  const api = await home({realImage: true});
  const recall = (await api.getTodayContent())!.photo!.recall_questions;
  expect(recall.length).toBe(2); // 데이터는 바꾸지 않는다
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('photo-polaroid'));
  expect(screen.getByText(recall[0])).toBeTruthy();
  expect(screen.queryByText(recall[1])).toBeNull();
  await press('읽어 주세요');
  await waitFor(() => expect(speak).toHaveBeenCalled());
  expect(speak).toHaveBeenLastCalledWith(recall[0]);
  expect(speak).not.toHaveBeenCalledWith(expect.stringContaining(recall[1])); // 둘째 질문은 어느 호출에서도 읽지 않는다
});

test('① 보기 전용(다시 보기)도 첫 질문 1개만', async () => {
  const api = await home({completedSteps: ['photo']});
  const recall = (await api.getTodayContent())!.photo!.recall_questions;
  await press(/사진 보기, 했어요/);
  await waitFor(() => screen.getByTestId('photo-polaroid'));
  expect(screen.getByText(recall[0])).toBeTruthy();
  expect(screen.queryByText(recall[1])).toBeNull();
});

test('③ 둘 중 고르기: 단계 제목과 질문 사이에 머리줄 「요즘 생각대로 한쪽을 골라요」', async () => {
  await home({completedSteps: ['photo']});
  await pressCourseNext();
  await waitFor(() => screen.getByTestId('p5-title'));
  expect(screen.getByText('요즘 생각대로 한쪽을 골라요')).toBeTruthy();
  expect(order(['step-header', 'p5-headline', 'p5-title', 'choice-group'])).toEqual(['step-header', 'p5-headline', 'p5-title', 'choice-group']);
});

test('③ 보기 전용(다시 보기)에도 같은 머리줄, 질문보다 앞', async () => {
  const api = await home({completedSteps: ['photo', 'question']});
  await press(/둘 중 고르기, 했어요/);
  await waitFor(() => screen.getByText('요즘 생각대로 한쪽을 골라요'));
  // 위 → 아래 글 순서: 머리줄이 질문(제목)보다 앞
  const prompt = (await api.getTodayContent())!.question!.prompt!;
  expect(textOrder(['요즘 생각대로 한쪽을 골라요', prompt])).toEqual(['요즘 생각대로 한쪽을 골라요', prompt]);
});

test('코스 홈 인사: 「하나씩 차례로 해요」(옛 「세 가지를 차례로 해요」 없음)', async () => {
  await home();
  const card = await waitFor(() => screen.getByTestId('first-greeting'));
  expect(within(card).getByText('하나씩 차례로 해요')).toBeTruthy();
  expect(card.props.accessibilityLabel).toBe('안녕하세요, 해님이에요, 하나씩 차례로 해요');
  expect(screen.queryByText(/세 가지를 차례로 해요/)).toBeNull();
});

test.each([[[]], [['photo']], [['photo', 'question']]] as const)('남은 수 문구 없음(마친 단계 %j)', async done => {
  await home({completedSteps: [...done]});
  await waitFor(() => screen.getByTestId('course-next'));
  expect(screen.queryByText(/남았어요/, {includeHiddenElements: true})).toBeNull();
});
