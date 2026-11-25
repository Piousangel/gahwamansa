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

  test('QA-2 M1 늦은 판정: 처음엔 지금 행이 첫 화면 안이었다가, 위에 무엇이 끼어들어 접힘 밖으로 밀리면 그때 내린다', async () => {
    const {ScrollView} = require('react-native');
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await home(true, {completedSteps: ['photo', 'recall', 'question']});
    await layHome(10, 60); // ④ 226~286 첫 화면 안 → 내리지 않고, 걸치는 ⑤는 민다(R-15)
    expect(scrollTo).not.toHaveBeenCalled();
    expect(marginTop('course-steps:pass_on')).toBe(12 + (300 - 298 + 1));
    const at = await layHome(10, 80); // 행이 커져 ④ 286~366 이 걸린다
    expect(ids('course-steps:').slice(1).map(marginTop)).toEqual(ids('course-steps:').slice(1).map(() => 12));
    expect(scrollTo).toHaveBeenLastCalledWith({y: at.hangul.bottom - 300 + 12, animated: true});
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

describe('문제 3: 건넨 날 P7 「가족에게 건넸어요」는 따로 접힘 단위', () => {
  async function toP7(hold = false) {
    const api = await home(true, {completedSteps: ['photo', 'recall', 'question', 'hangul']});
    if (hold) {
      jest.spyOn(api, 'getWeekStamps').mockReturnValue(new Promise(() => {})); // 이번 주 도장 응답이 아직 안 옴(본문 = null)
    }
    await pressCourseNext();
    await waitFor(() => screen.getByTestId('pass-on-choice'));
    fireEvent.press(screen.getAllByRole('radio')[0]);
    await press('건넬게요');
    await waitFor(() => (hold ? screen.getByText('오늘 코스를 마쳤어요') : screen.getByText('가족에게 건넸어요')));
  }

  test('QA-2 L2: 본문이 오기 전부터 그 자리(요소)가 있다 — useFoldGap 은 첫 요소 수로 재므로 나중에 끼우면 뒤 요소를 판정하지 않는다', async () => {
    await toP7(true);
    expect(ids('p7-item-')).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-passed', 'p7-item-text']);
    expect(screen.queryByText('가족에게 건넸어요')).toBeNull(); // 글은 본문과 함께 채운다
  });

  test('제목 바로 아래 한 요소, 둘째 줄(도장·내일 사진)은 그 다음 요소', async () => {
    await toP7();
    expect(ids('p7-item-')).toEqual(['p7-item-mount', 'p7-item-title', 'p7-item-passed', 'p7-item-text']);
    expect(screen.queryByText(/가족에게 건넸어요\n/)).toBeNull(); // 본문 덩어리 안에 없다
  });

  test('첫 화면 끝이 둘째 줄을 가르면 둘째 줄만 민다 — 「가족에게 건넸어요」는 첫 화면에 남는다', async () => {
    await toP7();
    // 고치기 전: 3줄 한 덩어리(364~466)가 접힘 420 에 걸려 덩어리째 밀렸다 → 첫 화면에 제목만(캡처 08)
    await act(async () => {
      lay('screen-body-area', 0, 444); // 접힘 420
      lay('p7-stage', 12, 0);
      lay('p7-item-mount', 0, 280); // 12~292
      lay('p7-item-title', 0, 40); // 308~348
      lay('p7-item-passed', 0, 34); // 364~398 → 첫 화면에 든다
      lay('p7-item-text', 0, 68); // 414~482 → 걸린다
    });
    expect(marginTop('p7-item-passed')).toBe(0);
    expect(marginTop('p7-item-text')).toBe(420 - 414 + 1);
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
    expect(screen.getByTestId('recall-confirm').props.accessibilityHint).toBe("보기를 하나 고르거나, 아래 '오늘은 넘어갈게요'를 눌러 주세요");
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
