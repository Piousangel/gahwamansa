import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {copy} from '../src/copy/copy';
import {pickStage} from '../src/features/link/p1Stage';
import {createFakeApi} from '../src/features/fakeApi';
import {BELOW_LINE_H, KEYPAD_FIXED, keypadKeyHeight} from '../src/features/link/keypadFit';
import {press} from '../testUtils/flow';

const RN = require('react-native');
afterEach(() => {
  jest.restoreAllMocks();
});

test('계산: 칸 68(시안) + 키 4줄(키 + 6) + 12 = 4 x 키 + 104', () => {
  expect(keypadKeyHeight(4 * 68 + 104)).toBe(68);
  expect(keypadKeyHeight(4 * 66 + 104)).toBe(66);
  expect(keypadKeyHeight(4 * 64 + 104)).toBe(64);
  expect(keypadKeyHeight(4 * 60 + 104)).toBeNull(); // 64 미만이면 null(다음 단계로)
});

const dims = (width: number, height: number, fontScale = 1) =>
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width, height, scale: 2, fontScale});

async function openConnect() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
}
// 레이아웃 모의: 본문 창 높이(Screen 스크롤 창 onLayout)·키패드 영역(위치 y·높이)
const viewport = async (h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: h}}});
  });
const area = async (y: number, h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('keypad-area', {includeHiddenElements: true}), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  });
const keyH = (label = '숫자 0') => {
  const st = screen.getByLabelText(label).props.style;
  return StyleSheet.flatten(typeof st === 'function' ? st({pressed: false}) : st).minHeight as number;
};
// 키패드 묶음 높이(칸 68 + 12 + 칸 아래 줄 + 키 4줄)
const keypadH = (k: number) => KEYPAD_FIXED + BELOW_LINE_H + 4 * k;
const inDock = (id: string) => {
  const dock = screen.queryByTestId('screen-dock');
  return !!dock && within(dock).queryByTestId(id) !== null;
};

const pad = async (h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('keypad-pinned'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: h}}});
  });
const firstHeight = () => StyleSheet.flatten(screen.getByTestId('connect-first').props.style).height as number | undefined;
const titleSize = () => StyleSheet.flatten(screen.getByRole('header').props.style).fontSize;
// 2단계(하단 고정 = 위 6 + 링크 줄 64 + 아래 max(28, 16+inset))를 뺀 창. 360×640 제스처 내비: 위 116(TopSafe 52 + 이전 바 64)
const FADE = 28;

// 리드 결정(11-19): 단계는 pickStage(창·글자·inset·문구) 한 번으로 정한다. 아래는 화면이 그 결과를 그대로 그리는지,
// 사후 검증(실제 키패드가 넘치면 한 단계, 최대 1회)만 onLayout 을 쓰는지 본다. jest 안전 영역 모의 inset 은 0.
const stageOf = (w: number, h: number, f: number) =>
  pickStage({
    windowH: h,
    windowW: w,
    fontScale: f,
    insets: {top: 0, bottom: 0},
    text: {title: copy.connect.title, safe: copy.safe.money, below: copy.connect.auto_hint, legal: copy.legal.agree_parent, links: [copy.connect.no_code_link, copy.connect.view_course]},
  });

describe('P1 화면 = pickStage 결과(이벤트를 기다리지 않음)', () => {
  for (const [w, h, f] of [
    [411, 914, 1],
    [360, 914, 1.3],
    [411, 740, 1],
    [360, 640, 1],
    [360, 640, 2], // 재확인 3 H4 재현 조건
    [320, 640, 1],
  ] as const) {
    test(`${w}×${h} 글자 ${f}: 첫 렌더부터 판정 단계(onLayout 없이)`, async () => {
      dims(w, h, f);
      await openConnect();
      const st = stageOf(w, h, f);
      expect(titleSize()).toBe(st.level >= 1 ? 22 : 28);
      expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(st.level >= 2);
      expect(inDock('legal-line')).toBe(st.level < 2);
      expect(inDock('connect-links')).toBe(st.level < 3);
      expect(keyH()).toBe(st.keyH);
      expect(firstHeight()).toEqual(st.level === 2 || st.level === 3 ? expect.any(Number) : undefined);
      // 묶음은 숨기지 않는다(빈 화면 없음)
      expect(StyleSheet.flatten(screen.getByTestId('connect-first').props.style).opacity).toBeUndefined();
      expect(screen.getByLabelText('숫자 1')).toBeTruthy();
    });
  }

  test('재확인 3 H4: 360×640 글자 200% 는 영역이 0 으로 눌려 onLayout 이 다시 오지 않아도 바로 4단계', async () => {
    dims(360, 640, 2);
    await openConnect();
    expect(stageOf(360, 640, 2).level).toBe(4);
    expect(firstHeight()).toBeUndefined(); // 4단계: 묶음 고정 없음, 보통 배치 + 스크롤
    expect(keyH()).toBe(64);
    expect(within(screen.getByTestId('screen-body')).getByTestId('connect-links')).toBeTruthy();
    expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
  });
});

describe('사후 검증(넘치면 한 단계, 최대 1회)', () => {
  test('같은 키 높이로 그린 키패드가 영역보다 크면 한 단계만 올리고, 또 넘쳐도 더 올리지 않는다', async () => {
    dims(411, 914);
    await openConnect();
    const st = stageOf(411, 914, 1);
    expect(st.level).toBe(0);
    // 키 높이는 첫 렌더부터 판정값이라 '기본 배치로 잰 높이'(옛 H2)는 생기지 않는다
    await pad(keypadH(st.keyH));
    await area(140, keypadH(st.keyH));
    expect(titleSize()).toBe(28);
    await pad(keypadH(st.keyH) + 30); // '모두 / 지움' 두 줄로 넘침
    expect(titleSize()).toBe(22); // 1단계
    await area(130, keypadH(keyH()));
    await pad(keypadH(keyH()) + 30); // 또 넘쳐도
    expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false); // 2단계로 가지 않는다(최대 1회)
  });

  test('글자 크기가 바뀌면 판정을 처음부터(올린 단계도 무효)', async () => {
    const spy = dims(411, 914);
    await openConnect();
    await area(140, 300);
    await pad(500);
    expect(titleSize()).toBe(22);
    spy.mockReturnValue({width: 411, height: 914, scale: 2, fontScale: 1});
    await act(async () => {
      fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 600}}});
    });
    expect(titleSize()).toBe(22); // 같은 입력이면 그대로
    spy.mockReturnValue({width: 411, height: 900, scale: 2, fontScale: 1});
    await act(async () => {
      fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 590}}});
    });
    await waitFor(() => expect(titleSize()).toBe(stageOf(411, 900, 1).level >= 1 ? 22 : 28));
  });
});

describe('2·3단계 묶음(그리기)', () => {
  test('잰 본문 창이 오면 묶음 = 창 − 위 여백 − 흐림(재리뷰 M1), 판정은 바뀌지 않는다', async () => {
    dims(360, 914, 1.3);
    await openConnect();
    const st = stageOf(360, 914, 1.3);
    expect(st.level === 2 || st.level === 3).toBe(true);
    await viewport(600);
    expect(firstHeight()).toBe(600 - 4 - FADE);
    expect(titleSize()).toBe(22);
    expect(inDock('connect-links')).toBe(st.level < 3);
  });

  test('읽기·시선 순서(3단계 이상): 제목 → 안심 줄 → 키패드 → 링크 → 약관(M5)', async () => {
    dims(320, 640);
    await openConnect();
    const ids = ['connect-safe', 'keypad-area', 'connect-links', 'legal-line'];
    const found = screen.root.findAll((n: {props: {testID?: string}}) => ids.includes(n.props.testID ?? ''), {deep: true});
    expect([...new Set(found.map((n: {props: {testID?: string}}) => n.props.testID))]).toEqual(ids);
  });

  test("재리뷰 L2: 스크롤 단계의 '번호가 없어요' 안내는 묶음 밖(링크 근처)", async () => {
    dims(320, 640);
    await openConnect();
    await press('번호가 없어요');
    expect(screen.getByTestId('connect-help')).toBeTruthy();
    expect(within(screen.getByTestId('connect-first')).queryByTestId('connect-help')).toBeNull();
  });
});

test('링크 두 개는 한 줄에 나란히', async () => {
  dims(411, 914);
  await openConnect();
  const row = screen.getByTestId('connect-links');
  expect(within(row).getByRole('button', {name: '번호가 없어요'})).toBeTruthy();
  expect(within(row).getByRole('button', {name: '코스 보기'})).toBeTruthy();
  expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
});

test('M6: 글자 키(모두 지움)는 어절 단위로만 줄바꿈(Android 는 음절 사이 WJ), 글자 22 이상', async () => {
  const {keepAllChildren} = require('../src/ui/koreanText');
  expect(keepAllChildren('모두 지움', 'android')).toBe('모⁠두 지⁠움');
  await openConnect();
  const k = screen.getByTestId('key-모두 지움', {includeHiddenElements: true});
  expect(k.props.lineBreakStrategyIOS).toBe('hangul-word');
  expect(StyleSheet.flatten(k.props.style).fontSize).toBeGreaterThanOrEqual(22);
});
