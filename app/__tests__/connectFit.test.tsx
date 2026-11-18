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

test('0단계(기준 기기 100%): 스크롤 없이 6칸·키 4줄이 남은 높이에 맞춰진다, 링크·약관은 하단 고정', async () => {
  dims(411, 914);
  await openConnect();
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  await area(140, keypadH(66));
  expect(keyH()).toBe(66);
  expect(inDock('connect-links')).toBe(true);
  expect(inDock('legal-line')).toBe(true);
});

// 리뷰 H1(11-19): 2단계부터 스크롤을 켜고 첫 화면 묶음 = 잰 창 높이로 고정 → 약관·링크는 첫 화면 밖(묶음 아래)
describe('리뷰 H1·디자인 9절 H3: 좌표로 본 P1 공간 단계', () => {
  test('360×640(창 536): 2단계에서 묶음 높이 = 창 − 위 여백, 키 4줄의 아래 끝이 창 안, 약관은 묶음 밖(스크롤 아래)', async () => {
    dims(360, 640); // 높이 700 미만 → 측정 전에도 2단계
    await openConnect();
    expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(true);
    await viewport(536); // 9절: 가용 약 600 − 상단 바 64
    const first = screen.getByTestId('connect-first');
    const firstH = StyleSheet.flatten(first.props.style).height as number;
    expect(firstH).toBe(532);
    const top = 32 + 16 + 60 + 16; // 제목 22 한 줄 + 간격 + 안심 2줄 + 간격
    await area(top, firstH - top);
    const k = keyH();
    expect(k).toBeGreaterThanOrEqual(64);
    expect(top + keypadH(k)).toBeLessThanOrEqual(firstH); // 0·지움 줄까지 첫 화면 안
    expect(within(first).getByLabelText('숫자 0')).toBeTruthy();
    expect(within(first).getByLabelText('한 칸 지우기')).toBeTruthy();
    expect(within(first).queryByTestId('legal-line')).toBeNull(); // 약관은 묶음 아래(첫 화면 밖)
    expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
  });

  test('묶음에 안 들어가면 3단계(하단 고정 없음, 링크도 묶음 아래) → 그래도 안 되면 4단계(키 64 + 스크롤, 묶음 고정 해제)', async () => {
    dims(320, 640);
    await openConnect();
    await viewport(480);
    expect(inDock('connect-links')).toBe(true); // 2단계: 링크는 아직 하단 고정
    await area(150, 300); // 키 64 로도 안 들어감
    expect(screen.queryByTestId('screen-dock')).toBeNull(); // 3단계
    const first = screen.getByTestId('connect-first');
    expect(within(first).queryByTestId('connect-links')).toBeNull();
    expect(within(screen.getByTestId('screen-body')).getByTestId('connect-links')).toBeTruthy();
    await viewport(560); // 하단 고정이 빠져 창이 커짐(창은 화면 맨 아래까지 → 아래 안전 영역·여백을 뺀다, 모의 inset 0)
    expect(StyleSheet.flatten(screen.getByTestId('connect-first').props.style).height).toBe(560 - 4 - 4);
    await area(170, 330); // 여전히 모자람 → 4단계
    expect(keyH()).toBe(64);
    expect(StyleSheet.flatten(screen.getByTestId('connect-first').props.style).height).toBeUndefined();
    // 320×640 4단계: 칸 + 키 1~9 세 줄의 아래 끝이 창 안(9절 "1~9 보임")
    const y = 170;
    expect(y + 68 + 12 + BELOW_LINE_H + 3 * (64 + 6)).toBeLessThanOrEqual(560);
    expect(screen.getByTestId('connect-safe')).toBeTruthy(); // U4
  });

  test('실측 반영: 계산상 들어가도 키패드 실제 높이(두 줄 글자 키)가 영역보다 크면 다음 단계로', async () => {
    dims(360, 640);
    await openConnect();
    await viewport(536);
    await area(124, keypadH(66)); // 계산식으로는 키 66 이 들어감
    expect(inDock('connect-links')).toBe(true); // 아직 2단계
    await act(async () => {
      fireEvent(screen.getByTestId('keypad-pinned'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: keypadH(66) + 30}}});
    });
    expect(screen.queryByTestId('screen-dock')).toBeNull(); // '모두 / 지움' 두 줄로 넘침 → 3단계
  });

  test('읽기·시선 순서: 제목 → 안심 줄 → 키패드 → 링크 → 약관, 링크는 제목 위로 가지 않는다(M5)', async () => {
    dims(320, 640);
    await openConnect();
    await viewport(480);
    await area(150, 300);
    const ids = ['connect-safe', 'keypad-area', 'connect-links', 'legal-line'];
    const found = screen.root.findAll((n: {props: {testID?: string}}) => ids.includes(n.props.testID ?? ''), {deep: true});
    expect([...new Set(found.map((n: {props: {testID?: string}}) => n.props.testID))]).toEqual(ids);
  });

  test('200%: 측정 전에도 2단계(약관 줄은 본문 끝), 창을 알기 전에는 키패드 영역을 재지 않는다', async () => {
    dims(411, 914, 2);
    await openConnect();
    await area(150, 300); // 창 높이를 모르는 동안은 무시
    expect(inDock('connect-links')).toBe(true);
    expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
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
