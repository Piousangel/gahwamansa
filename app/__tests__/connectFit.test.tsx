import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
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
    fireEvent(screen.getByTestId('keypad-area'), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
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
const TOP_ROWS = 32 + 16 + 60 + 16; // 제목 22 한 줄 + 간격 + 안심 2줄 + 간격(묶음 안 키패드 영역 y)

test('0단계(기준 기기 100%): 스크롤 없이 6칸·키 4줄이 남은 높이에 맞춰진다, 링크·약관은 하단 고정', async () => {
  dims(411, 914);
  await openConnect();
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  await area(140, keypadH(66));
  expect(keyH()).toBe(66);
  expect(inDock('connect-links')).toBe(true);
  expect(inDock('legal-line')).toBe(true);
});

// 재리뷰(11-19) 재현 B: 첫 측정의 키패드 높이는 키 높이를 정하기 전 기본 배치(키 68·간격 8·칸 아래 16 ≈ 422)로 잰 값
test('재현 B(H2): 기본 배치로 잰 키패드 높이(422)로는 판정하지 않는다 — 영역 410 이면 키 68 로 0단계 유지', async () => {
  dims(411, 914);
  await openConnect();
  await pad(422); // keyH 없이 잰 값(실제 순서: 키패드 → 영역)
  await area(140, 410);
  expect(titleSize()).toBe(28); // 0단계(제목 28) 유지
  expect(keyH()).toBe(68);
  await pad(keypadH(68)); // 키 68 로 다시 그린 실제 높이 = 410
  expect(titleSize()).toBe(28);
  // 같은 키 높이에서 실제로 넘치면('모두 / 지움' 두 줄) 그때 다음 단계
  await pad(keypadH(68) + 30);
  expect(titleSize()).toBe(22);
});

describe('재리뷰 H1·M3: 실제 이벤트 순서(영역 → 창)로 본 P1 공간 단계', () => {
  test('재현 A(H1): 2단계 실패 → 3단계 전환 커밋의 옛 묶음 영역으로는 판정하지 않고, 3단계 창에서 키 12개가 들어가면 3단계에 머문다', async () => {
    dims(360, 640); // 높이 700 미만 → 2단계부터
    await openConnect();
    await area(TOP_ROWS, 0); // 창을 알기 전(묶음 숨김) 영역 — 판정 안 함
    await viewport(430); // 2단계 창(하단 고정 링크 줄 제외)
    const first2 = 430 - 4 - FADE;
    expect(firstHeight()).toBe(first2);
    await area(TOP_ROWS, first2 - TOP_ROWS); // 302 − … 키 64 로도 모자람
    expect(screen.queryByTestId('screen-dock')).toBeNull(); // → 3단계
    // 같은 커밋에서 오는, 옛(2단계) 창으로 만든 묶음 안 영역 — 이것으로 판정하면 4단계로 떨어진다(버그)
    await area(TOP_ROWS, first2 - TOP_ROWS - 4);
    await viewport(560); // 3단계 진짜 창(하단 고정이 빠져 커짐, 모의 inset 0)
    const first3 = 560 - 4 - FADE;
    expect(firstHeight()).toBe(first3);
    await area(TOP_ROWS, first3 - TOP_ROWS);
    expect(firstHeight()).toBe(first3); // 4단계(묶음 고정 해제)가 아니다
    const k = keyH();
    expect(k).toBeGreaterThanOrEqual(64);
    // 좌표: 키패드 묶음 아래 끝(영역 y + 칸 + 키 4줄)이 흐림 위(창 − 위 여백 − 흐림) 안
    expect(TOP_ROWS + keypadH(k)).toBeLessThanOrEqual(560 - 4 - FADE);
    expect(within(screen.getByTestId('connect-first')).queryByTestId('legal-line')).toBeNull(); // 약관은 묶음 밖
    expect(within(screen.getByTestId('connect-first')).queryByTestId('connect-links')).toBeNull();
  });

  test('3단계 창에서도 안 들어가면 4단계(키 64 + 스크롤, 묶음 고정 해제), 칸 + 키 1~9 세 줄은 첫 화면 안', async () => {
    dims(320, 640);
    await openConnect();
    await viewport(400);
    await area(150, 400 - 4 - FADE - 150);
    expect(screen.queryByTestId('screen-dock')).toBeNull();
    await area(150, 200); // 옛 묶음 영역(무시)
    await viewport(520);
    await area(150, 520 - 4 - FADE - 150); // 338: 키 64 로도 모자람
    expect(keyH()).toBe(64);
    expect(firstHeight()).toBeUndefined();
    expect(150 + 68 + 12 + BELOW_LINE_H + 3 * (64 + 6)).toBeLessThanOrEqual(520); // 9절 "1~9 보임"(4단계는 위 여백 최소)
    expect(screen.getByTestId('connect-safe')).toBeTruthy(); // U4
  });

  test('재리뷰 L1: 이 단계의 창 높이를 알기 전에는 묶음을 숨기고 약관·링크를 그리지 않는다(겹친 한 프레임 방지)', async () => {
    dims(360, 640);
    await openConnect();
    expect(StyleSheet.flatten(screen.getByTestId('connect-first').props.style).opacity).toBe(0);
    expect(screen.queryByTestId('legal-line')).toBeNull();
    await viewport(430);
    expect(StyleSheet.flatten(screen.getByTestId('connect-first').props.style).opacity).toBeUndefined();
    expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
  });

  test('재리뷰 M1: 2·3단계 묶음은 아래 흐림(28)만큼 짧다 — 마지막 키 줄이 흐림 밑에 깔리지 않게', async () => {
    const {SCREEN_FADE_H} = require('../src/ui/Screen');
    expect(SCREEN_FADE_H).toBe(FADE);
    dims(360, 640);
    await openConnect();
    await viewport(430);
    expect(firstHeight()).toBe(430 - 4 - SCREEN_FADE_H);
  });

  test('읽기·시선 순서(3단계): 제목 → 안심 줄 → 키패드 → 링크 → 약관, 링크는 제목 위로 가지 않는다(M5)', async () => {
    dims(320, 640);
    await openConnect();
    await viewport(400);
    await area(150, 200);
    await viewport(520);
    const ids = ['connect-safe', 'keypad-area', 'connect-links', 'legal-line'];
    const found = screen.root.findAll((n: {props: {testID?: string}}) => ids.includes(n.props.testID ?? ''), {deep: true});
    expect([...new Set(found.map((n: {props: {testID?: string}}) => n.props.testID))]).toEqual(ids);
  });

  test('재리뷰 L2: 스크롤 단계에서 \'번호가 없어요\' 안내는 묶음 밖(링크 근처)에 나오고 보이게 스크롤한다', async () => {
    dims(320, 640);
    await openConnect();
    await viewport(400);
    await area(150, 200);
    await viewport(520);
    await press('번호가 없어요');
    const help = screen.getByTestId('connect-help');
    expect(within(screen.getByTestId('connect-first')).queryByTestId('connect-help')).toBeNull();
    expect(help).toBeTruthy();
  });

  test('재리뷰 L5: 글자 크기가 바뀌면 단계를 처음부터 다시 잰다', async () => {
    const spy = dims(411, 914);
    await openConnect();
    await area(140, 300); // 0단계 실패 → 1단계
    expect(titleSize()).toBe(22);
    spy.mockReturnValue({width: 411, height: 914, scale: 2, fontScale: 1.3});
    await act(async () => {
      fireEvent(screen.getByTestId('screen-body'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 600}}});
    });
    await waitFor(() => expect(titleSize()).toBe(28)); // 0단계부터 다시
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
  const k = screen.getByTestId('key-모두 지움');
  expect(k.props.lineBreakStrategyIOS).toBe('hangul-word');
  expect(StyleSheet.flatten(k.props.style).fontSize).toBeGreaterThanOrEqual(22);
});
