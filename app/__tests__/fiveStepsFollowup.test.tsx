// #254 캡처 [후속] 4건(docs/team/qa/evidence/2026-11-25-five-steps README 문제 1·3·4·5)을 고정한다.
// jest 에는 레이아웃이 없어 onLayout 을 손으로 보내 접힘(R-15)·스크롤 계산을 보고, 배치(옆·아래)는 Yoga 가 그렇게 놓는 스타일 조건으로 본다.
// 실기기 배치 증거는 docs/team/qa/evidence/2026-11-25-five-steps-followup.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, type FakeOptions} from '../src/features/fakeApi';
import {resetFeaturesForTest, setFeature} from '../src/lib/features';
import {createPrefs, setPrefsForTest} from '../src/lib/prefs';
import {memoryStore} from '../src/lib/kvStore';
import {press, pressCourseNext} from '../testUtils/flow';
import {nowRowRange} from '../src/features/course/fiveSteps';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 640, scale: 3, fontScale: mockFontScale}),
}));

beforeEach(async () => {
  const p = createPrefs(memoryStore());
  await p.markFirstGreetingSeen();
  setPrefsForTest(p);
});
afterEach(() => {
  resetFeaturesForTest();
  setPrefsForTest(null);
  mockFontScale = 1;
});

async function home(five: boolean, opts: FakeOptions = {}) {
  setFeature('fiveSteps', five);
  const api = createFakeApi({linked: true, consented: true, realImage: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}
const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 360, height: h}}});
const marginTop = (id: string): number => StyleSheet.flatten(screen.getByTestId(id).props.style)?.marginTop ?? 0;
const ids = (prefix: string) =>
  screen.UNSAFE_root.findAll(n => typeof n.props?.testID === 'string' && n.props.testID.startsWith(prefix) && typeof n.type === 'string').map(n => n.props.testID as string);

/** 코스 홈 묶음을 재고, 각 요소의 실제 위 끝(넣은 접힘 여백 포함)을 돌려준다 */
async function layHome(top: number, rowH: number) {
  const items = ids('course-steps:');
  await act(async () => {
    lay('screen-body-area', 0, 324); // 접힘 기준 = 324 − '더 있음' 띠 24 = 300
    lay('screen-body', 0, 300); // 스크롤 창
    lay('course-steps', top, 0);
    for (const id of items) {
      lay(id, 0, rowH);
    }
  });
  const at: Record<string, {top: number; bottom: number}> = {};
  let y = top;
  for (const id of items) {
    y += marginTop(id);
    at[id.replace('course-steps:', '')] = {top: y, bottom: y + rowH};
    y += rowH;
  }
  return at;
}

describe('문제 1: 코스 홈 지금 행으로 스크롤', () => {
  test('nowRowRange: 자연 위치를 쌓고, 첫 화면 끝을 넘으면 scroll', () => {
    const order = ['photo', 'recall', 'question', 'hangul', 'pass_on'];
    const h = {photo: 80, recall: 80, question: 80, hangul: 80, pass_on: 80};
    expect(nowRowRange(order, 10, h, 12, 'hangul', 300)).toEqual({top: 286, bottom: 366, scroll: true});
    expect(nowRowRange(order, 10, h, 12, 'recall', 300)).toEqual({top: 102, bottom: 182, scroll: false});
    expect(nowRowRange(order, 10, {photo: 80}, 12, 'hangul', 300)).toBeNull(); // 아직 다 재지 않음
  });

  test('③ 뒤 지금 행(④)이 첫 화면 끝에 걸리면: 접힘 여백 없이, 실제 행 끝이 창 아래 끝(+12)에 오게 내린다', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo', 'recall', 'question']});
    // 위 끝 10, 행 80, 간격 12 → ④ 낱말 쓰기 286~366 이 접힘 300 에 걸린다
    const at = await layHome(10, 80);
    // 내린 화면 위에 빈칸(접힘 여백)이 없다: 모든 요소 사이는 간격 12뿐
    expect(ids('course-steps:').slice(1).map(marginTop)).toEqual(ids('course-steps:').slice(1).map(() => 12));
    // 실제 행 끝 기준으로 내린다(고치기 전: 여백만큼 아래에 있는 행을 자연 위치로 내려 반쯤 가려졌다)
    expect(scrollTo).toHaveBeenLastCalledWith({y: at.hangul.bottom - 300 + 12, animated: true});
  });

  test('#300 QA-1 L1: 첫 인사(keep) 없고 지금 행이 창보다 크면, 행 끝이 아니라 행 위 − 12 에 맞춰 내린다(제목부터 읽힘)', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo', 'recall', 'question']});
    expect(screen.queryByTestId('first-greeting')).toBeNull(); // keep 없음
    // 행 320 > 창 300: ④ 1006~1326. 끝 맞춤이면 y = 1326 − 300 + 12 = 1038 로 행 위 32 가 잘린다
    const at = await layHome(10, 320);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({y: at.hangul.top - 12, animated: true});
  });

  test('QA-2 M1 고정: 내린 뒤 높이가 바뀌어(안내 띠가 사라지는 등) 지금 행이 첫 화면에 들어도 접힘 여백을 다시 켜지 않는다', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo', 'recall', 'question']});
    await layHome(10, 80); // ④ 286~366 → 내림
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // 행 60: ④ 226~286 은 들고, ⑤ 298~358 이 접힘 300 에 걸린다 — 고정이 없으면 ⑤ 앞에 여백이 생겨 내린 화면 안에 빈칸
    await layHome(10, 60);
    expect(ids('course-steps:').slice(1).map(marginTop)).toEqual(ids('course-steps:').slice(1).map(() => 12));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  test('QA-2 재확인 M: 첫 측정에서 안 내렸으면, 뒤에 위쪽 오류 안내가 끼어들어 ④가 접힘 밖으로 가도 내리지 않는다(안내가 화면 위에 남는다)', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo', 'recall', 'question'], failRecord: 1});
    await layHome(10, 60); // 첫 측정: ④ 226~286 첫 화면 안 → 내리지 않음(4단계라 ⑤ 행은 없다, 기획 v2.1 Q7)
    expect(scrollTo).not.toHaveBeenCalled();
    expect(ids('course-steps:')).not.toContain('course-steps:pass_on');
    // '여기까지' 기록이 끊겨 맨 위에 실패 안내가 생긴다 → ④가 접힘 밖으로
    await press('오늘은 여기까지 할게요');
    await waitFor(() => screen.getByTestId('course-stop-error'));
    await act(async () => {
      lay('course-steps:stop-error', 0, 100); // 10~110, ④는 338~398
    });
    expect(ids('course-steps:')[0]).toBe('course-steps:stop-error'); // 안내는 묶음 맨 위
    expect(scrollTo).not.toHaveBeenCalled(); // 내리지 않는다 = 막 뜬 안내가 첫 화면에 보인다
    // 접힘 여백 규칙 그대로: 안내 10~110 아래 ① 122~182, ② 194~254, ③ 266~326 이 접힘 300 에 걸려 ③을 통째로 민다
    expect(marginTop('course-steps:question')).toBe(12 + (300 - 266 + 1));
  });

  test('QA-2 재확인 L-a: 단계가 바뀌면(③ → ④) 고정이 풀려 새 지금 행으로 다시 내린다', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo', 'recall']});
    await layHome(10, 100); // ③ 234~334 → 내림
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // ③을 넘어가고 홈으로 → 지금 행 ④(4단계의 마지막 — 예전 ④ → ⑤ 시험을 한 칸 앞으로, 기획 v2.1 Q7)
    await pressCourseNext();
    await waitFor(() => screen.getByTestId('choice-group'));
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByTestId('step-now-row'));
    const at = await layHome(10, 100); // ④ 346~446
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({y: at.hangul.bottom - 300 + 12, animated: true});
    expect(ids('course-steps:').slice(1).map(marginTop)).toEqual(ids('course-steps:').slice(1).map(() => 12));
  });


  test('지금 행이 첫 화면 안이면(①·② 차례) 내리지 않고 접힘 여백은 그대로(R-15)', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo']});
    // ② 지금 행 102~182 는 첫 화면 안. 넷째 행(④ 286~366)이 접힘에 걸리면 통째로 민다
    await layHome(10, 80);
    expect(marginTop('course-steps:hangul')).toBe(12 + (300 - 286 + 1));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('대기열 54: nowRowRange 에 지킬 요소(keep)를 주면, 내릴 때 그 요소 위 끝이 창 위로 밀려 나가면 내리지 않는다', () => {
    const order = ['greet', 'greet-title', 'photo', 'recall'];
    const h = {greet: 100, 'greet-title': 100, photo: 100, recall: 100};
    // photo 234~334 → 내리면 y = 334 − 300 + 12 = 46 > 인사 위 끝 10: 인사 카드 윗부분이 잘린다
    expect(nowRowRange(order, 10, h, 12, 'photo', 300)).toEqual({top: 234, bottom: 334, scroll: true});
    expect(nowRowRange(order, 10, h, 12, 'photo', 300, 'greet')).toEqual({top: 234, bottom: 334, scroll: false});
    // 내려도 인사 위 끝이 남으면(내릴 거리 ≤ 인사 위 끝) 그대로 내린다
    expect(nowRowRange(order, 100, {...h, greet: 40, 'greet-title': 40}, 12, 'photo', 300, 'greet')).toEqual({top: 204, bottom: 304, scroll: true}); // 16 ≤ 100
    // keep 이 없거나 지금 행보다 아래면 예전과 같다
    expect(nowRowRange(order, 10, h, 12, 'photo', 300, 'nope')).toEqual({top: 234, bottom: 334, scroll: true});
  });

  test('대기열 54(#287 QA-2 L3): 첫날 200% — 첫 인사 카드가 반쯤 잘리게 내리지 않고, 접힘 여백(R-15)으로 지금 행을 통째로 아래에', async () => {
    setPrefsForTest(createPrefs(memoryStore())); // 첫 인사를 아직 안 본 기기
    mockFontScale = 2;
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true);
    await waitFor(() => screen.getByTestId('first-greeting'));
    expect(ids('course-steps:').slice(0, 3)).toEqual(['course-steps:greet', 'course-steps:greet-title', 'course-steps:photo']);
    // 인사 10~110, 제목 122~222, ① 사진 보기(지금) 234~334 가 접힘 300 에 걸린다
    await layHome(10, 100);
    expect(scrollTo).not.toHaveBeenCalled(); // 고치기 전: y 46 으로 내려 인사 카드 위 36 이 잘렸다
    expect(marginTop('course-steps:photo')).toBe(12 + (300 - 234 + 1));
  });

  test('스위치 꺼짐(3단계): 스크롤 없음, 접힘 여백은 예전 그대로', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(false, {completedSteps: ['photo', 'question']});
    // 행 100: 사진 10~110, 고르기 122~222, 쓰기(지금) 234~334 → 접힘 300 에 걸려 민다
    await layHome(10, 100);
    expect(marginTop('course-steps:hangul')).toBe(12 + (300 - 234 + 1));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('문제 3(옛 건넨 날 P7): 4단계에서는 「가족에게 건넸어요」 요소가 없다 — 기획 v2.1 Q7', () => {
  async function toP7(hold = false) {
    const api = await home(true, {completedSteps: ['photo', 'recall', 'question']});
    if (hold) {
      jest.spyOn(api, 'getWeekStamps').mockReturnValue(new Promise(() => {})); // 이번 주 도장 응답이 아직 안 옴(본문 = null)
    }
    await pressCourseNext();
    await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
    await press('오늘은 넘어갈게요');
    await waitFor(() => (hold ? screen.getByText('오늘 코스를 마쳤어요') : screen.getByText(/도장을 찍었어요/)));
  }

  test('본문이 오기 전에도, 온 뒤에도 P7 묶음은 3단계와 같다(마운트 · 제목 · 둘째 줄)', async () => {
    await toP7(true);
    expect(ids('p7-item-')).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-text']);
    screen.unmount();
    await toP7();
    expect(ids('p7-item-')).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-text']);
    expect(screen.queryByText(/가족에게 건넸어요/)).toBeNull();
  });

  test('스위치 꺼짐(3단계) P7 요소는 예전 그대로(마운트 · 제목 · 둘째 줄)', async () => {
    await home(false, {completedSteps: ['photo', 'question']});
    await pressCourseNext();
    await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('낱말 쓰는 칸'), '나무');
    });
    await act(async () => new Promise<void>(r => setTimeout(() => r(), 1600)));
    await press('마칠게요');
    await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
    expect(ids('p7-item-')).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-text']);
  });
});

describe('문제 4: ② 넘어가기는 카드 아래 본문(100%도)', () => {
  test('QA-2 M2: 꺼진 [이걸로 할게요] 읽기 힌트가 아래 넘어가기를 알리고, 고르면 힌트는 없다', async () => {
    await home(true, {completedSteps: ['photo']});
    await pressCourseNext();
    await waitFor(() => screen.getByTestId('recall-question'));
    expect(screen.getByTestId('recall-confirm').props.accessibilityHint).toBe("보기를 고르면 눌려요. 넘어가려면 '오늘은 넘어갈게요'를 눌러 주세요");
    fireEvent.press(screen.getAllByRole('radio')[0]);
    expect(screen.getByTestId('recall-confirm').props.accessibilityHint).toBeUndefined();
  });

  test('QA-2 M2: 마지막 카드와 넘어가기 사이는 묶음 간격 section(32) = 카드 사이 12보다 넓다(오누름 방지)', async () => {
    await home(true, {completedSteps: ['photo']});
    await pressCourseNext();
    await waitFor(() => screen.getByTestId('recall-question'));
    const gap = marginTop('recall-body:skip') + (StyleSheet.flatten(screen.getByTestId('recall-skip-gap').props.style)?.paddingTop ?? 0);
    expect(gap).toBe(32);
  });
});

describe('문제 5: 다 마친 홈 도장 1개 자리', () => {
  const ALL = ['photo', 'recall', 'question', 'hangul', 'pass_on'] as const;
  test('100%: 줄바꿈 묶음이 아니라 한 줄 — 제목이 남은 폭(flex 1), 도장은 옆에서 줄지 않는다(제목 줄 수와 무관)', async () => {
    await home(true, {completedSteps: [...ALL]});
    const head = StyleSheet.flatten(screen.getByTestId('course-done-head').props.style);
    expect(head.flexDirection).toBe('row');
    expect(head.flexWrap).not.toBe('wrap'); // wrap 이면 여러 줄 제목이 한 줄 전체를 차지해 도장이 아래 줄 왼쪽으로 간다(#254 캡처 02)
    expect(StyleSheet.flatten(screen.getByTestId('course-done-head-text').props.style)).toMatchObject({flex: 1, minWidth: 0});
    expect(StyleSheet.flatten(screen.getByTestId('course-done-head-stamp').props.style)?.flexShrink).toBe(0); // 명시(QA-2 L3: 기본값에 기대면 늘 통과)
  });

  test('200%: 도장은 제목 아래 오른쪽 끝(줄 머리 왼쪽 원 금지), 여전히 1개', async () => {
    mockFontScale = 2;
    await home(true, {completedSteps: [...ALL]});
    expect(StyleSheet.flatten(screen.getByTestId('course-done-head').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(screen.getByTestId('course-done-head-stamp').props.style)?.alignSelf).toBe('flex-end');
    expect(screen.getAllByTestId('done-title-stamp', {includeHiddenElements: true})).toHaveLength(1);
  });
});
