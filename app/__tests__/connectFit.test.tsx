import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {BELOW_LINE_H, keypadKeyHeight} from '../src/features/link/keypadFit';
import {press} from '../testUtils/flow';

test('계산: 칸 68(시안) + 키 4줄(키 + 6) + 12 = 4 x 키 + 104', () => {
  expect(keypadKeyHeight(4 * 68 + 104)).toBe(68);
  expect(keypadKeyHeight(4 * 66 + 104)).toBe(66);
  expect(keypadKeyHeight(4 * 64 + 104)).toBe(64);
  expect(keypadKeyHeight(4 * 60 + 104)).toBeNull(); // 64 미만이면 null(보조 문구를 숨겨 공간 확보)
});

async function openConnect() {
  render(<AppRoot api={createFakeApi()} />);
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
}
const layout = async (h: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('keypad-area'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 328, height: h}}});
  });

test('어르신 번호 화면: 본문 스크롤 없이 6칸·키 4줄이 남은 높이에 맞춰진다', async () => {
  await openConnect();
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(false);
  await layout(4 * 66 + 104 + BELOW_LINE_H); // 칸 아래 안내 한 줄 포함
  const key = screen.getByLabelText('숫자 0');
  const st = typeof key.props.style === 'function' ? key.props.style({pressed: false}) : key.props.style;
  const flat = Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st;
  expect(flat.minHeight).toBe(66);
  expect(flat.minHeight).toBeGreaterThanOrEqual(64);
  for (const d of '0123456789') {
    expect(screen.getByLabelText(`숫자 ${d}`)).toBeTruthy();
  }
});

test('작은 화면: 제목 크기 → 하단 고정을 빼고 링크·약관을 키패드 아래로 → 그래도 모자라면 키 64 + 스크롤(잘리지 않음), 안심 줄은 끝까지 남는다(U4)', async () => {
  await openConnect();
  expect(screen.getByTestId('connect-safe')).toBeTruthy();
  await layout(4 * 60 + 104);
  expect(screen.getByTestId('connect-safe')).toBeTruthy(); // UX U4: 안심 줄은 줄어들어도 남는다
  const {StyleSheet} = require('react-native');
  expect(StyleSheet.flatten(screen.getByRole('header').props.style).fontSize).toBe(22);
  await layout(4 * 60 + 104);
  expect(screen.queryByTestId('screen-dock')).toBeNull(); // 감사 H3: 하단 고정(약관 줄)이 키패드를 가리지 않게 뺀다
  expect(screen.getByTestId('connect-links')).toBeTruthy();
  expect(screen.getByTestId('legal-line')).toBeTruthy();
  await layout(4 * 60 + 104);
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(true); // 마지막 수단
  expect(screen.getByLabelText('숫자 0')).toBeTruthy();
  expect(screen.getByTestId('connect-safe')).toBeTruthy();
});

test('키패드가 들어가면 4줄 모두 영역 안(키 x4 + 88 <= 영역)', async () => {
  await openConnect();
  const area = 4 * 66 + 104 + BELOW_LINE_H + 3;
  await layout(area);
  const {StyleSheet} = require('react-native');
  const st = screen.getByLabelText('숫자 7').props.style;
  const k = StyleSheet.flatten(typeof st === 'function' ? st({pressed: false}) : st).minHeight as number;
  expect(4 * k + 104 + BELOW_LINE_H).toBeLessThanOrEqual(area);
  for (const d of ['7', '8', '9', '0']) {
    expect(screen.getByLabelText(`숫자 ${d}`)).toBeTruthy();
  }
});

test('링크 두 개는 하단 영역에서 한 줄에 나란히', async () => {
  await openConnect();
  const row = screen.getByTestId('connect-links');
  expect(within(row).getByRole('button', {name: '번호가 없어요'})).toBeTruthy();
  expect(within(row).getByRole('button', {name: '코스 보기'})).toBeTruthy();
  const {StyleSheet} = require('react-native');
  expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
});

// 실기기 예산(dp, P1 v4 "다음" 없음). 위 = max(inset, 24) + 이전 바 64, 본문 = 위 4 + 제목 두 줄(28 → 68, 22 → 58) + gap 16
// (+ 안심 줄 30 + gap 16) + 아래 8, 하단 = 위 6 + 링크 줄 64 + 약관 줄 34 + max(28, 16 + inset).
// 2단계(감사 H3): 하단 고정 없이 링크 줄 64 + 약관 줄 34 가 본문 끝으로, 아래는 안전 여백만
const keypadArea = (H: number, insetTop: number, insetBottom: number, lv: number) => {
  const top = Math.max(insetTop, 24) + 64;
  const body = 4 + (lv >= 1 ? 58 : 68) + 16 + 46 + 8 + (lv >= 2 ? 64 + 34 : 0); // 안심 줄 30 + gap 16 은 늘 있다(U4)
  const dock = lv >= 2 ? Math.max(28, 16 + insetBottom) : 6 + 64 + 34 + Math.max(28, 16 + insetBottom);
  return H - top - body - dock;
};
// 칸 68 + 칸 아래 안내 한 줄(BELOW_LINE_H) + 키 4줄
const allFour = (area: number) => {
  const k = keypadKeyHeight(area - BELOW_LINE_H);
  return k !== null && 4 * k + 104 + BELOW_LINE_H <= area && k >= 64;
};
// 0 그대로, 1 제목 22, 2 하단 고정 없이 링크·약관을 본문 끝으로. 셋 다 안 되면 3단계(스크롤)
const firstFit = (H: number, it: number, ib: number) => [0, 1, 2].find(lv => allFour(keypadArea(H, it, ib, lv)));

test('갤럭시 S25(780dp, 상단 24·하단 48): 안심 줄을 둔 채 2단계(링크·약관 본문 끝)에서 4줄 모두 들어간다', () => {
  expect(firstFit(780, 24, 48)).toBe(2);
});

test('360x640dp 제스처 내비게이션(하단 16): 안심 줄 유지(U4)로 100%에서도 3단계(스크롤) — 디자인 확인 항목', () => {
  expect(firstFit(640, 24, 16)).toBeUndefined();
});

test('360x640dp 3버튼 내비게이션(하단 48): 64 키로는 안 들어가 4단계(스크롤)로 잘리지 않게 한다', () => {
  expect(firstFit(640, 24, 48)).toBeUndefined();
});

// 감사 2026-11-18 H3·M5·M6 재현 조건(320×640·360×640 100%, 글자 200%): 하단 고정 약관 줄이 키패드를 가리지 않고, 링크는 제목 위로 가지 않는다
describe('감사 H3·M5: 작은 화면·큰 글자 P1', () => {
  const RN = require('react-native');
  const order = (ids: string[]) => {
    const all = screen.root.findAll((n: {props: {testID?: string}}) => ids.includes(n.props.testID ?? ''), {deep: true});
    return [...new Set(all.map((n: {props: {testID?: string}}) => n.props.testID))];
  };
  for (const [name, dims] of [
    ['320×640 100%', {width: 320, height: 640, scale: 2, fontScale: 1}],
    ['360×640 100%', {width: 360, height: 640, scale: 2, fontScale: 1}],
    ['411×914 200%', {width: 411, height: 914, scale: 2.6, fontScale: 2}],
  ] as const) {
    test(`${name}: 하단 고정 없음, 키 0~9·지움 모두 본문에, 순서는 제목 → 안심 줄 → 키패드 → 링크 → 약관`, async () => {
      jest.spyOn(RN, 'useWindowDimensions').mockReturnValue(dims);
      try {
        await openConnect();
        expect(screen.queryByTestId('screen-dock')).toBeNull();
        for (const d of '0123456789') {
          expect(screen.getByLabelText(`숫자 ${d}`)).toBeTruthy();
        }
        expect(screen.getByLabelText('전부 지우기')).toBeTruthy();
        expect(order(['connect-safe', 'keypad-area', 'connect-links', 'legal-line'])).toEqual(['connect-safe', 'keypad-area', 'connect-links', 'legal-line']);
        // 링크는 이전 바 줄(제목 위)에 없다
        const links = screen.getByTestId('connect-links');
        expect(within(screen.getByTestId('screen-body')).getByTestId('connect-links')).toBe(links);
      } finally {
        jest.restoreAllMocks();
      }
    });
  }

  test('M6: 글자 키(모두 지움·지움)는 한 줄 고정 + 줄여 맞춤(최소 20)', async () => {
    await openConnect();
    const k = screen.getByTestId('key-모두 지움');
    expect(k.props.numberOfLines).toBe(1);
    expect(k.props.adjustsFontSizeToFit).toBe(true);
    expect(26 * k.props.minimumFontScale).toBeGreaterThanOrEqual(20);
  });
});
