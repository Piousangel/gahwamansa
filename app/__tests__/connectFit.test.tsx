import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {keypadKeyHeight} from '../src/features/link/keypadFit';
import {press} from '../testUtils/flow';

test('계산: 칸 52 + 키 4줄(키 + 6) + 12 = 4 x 키 + 88', () => {
  expect(keypadKeyHeight(4 * 68 + 88)).toBe(68);
  expect(keypadKeyHeight(4 * 66 + 88)).toBe(66);
  expect(keypadKeyHeight(4 * 64 + 88)).toBe(64);
  expect(keypadKeyHeight(4 * 60 + 88)).toBeNull(); // 64 미만이면 null(보조 문구를 숨겨 공간 확보)
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
  await layout(4 * 66 + 88);
  const key = screen.getByLabelText('숫자 0');
  const st = typeof key.props.style === 'function' ? key.props.style({pressed: false}) : key.props.style;
  const flat = Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st;
  expect(flat.minHeight).toBe(66);
  expect(flat.minHeight).toBeGreaterThanOrEqual(64);
  for (const d of '0123456789') {
    expect(screen.getByLabelText(`숫자 ${d}`)).toBeTruthy();
  }
});

test('작은 화면: 보조 문구 → 제목 크기 → 링크를 위 줄로 → 그래도 모자라면 키 64 + 스크롤(잘리지 않음)', async () => {
  await openConnect();
  expect(screen.getByText('틀려도 괜찮아요')).toBeTruthy();
  await layout(4 * 60 + 88);
  expect(screen.queryByText('틀려도 괜찮아요')).toBeNull();
  await layout(4 * 60 + 88);
  const {StyleSheet} = require('react-native');
  expect(StyleSheet.flatten(screen.getByRole('header').props.style).fontSize).toBe(22);
  await layout(4 * 60 + 88);
  expect(within(screen.getByTestId('screen-dock')).queryByTestId('connect-links')).toBeNull(); // 링크가 위 줄로
  expect(screen.getByTestId('connect-links')).toBeTruthy();
  await layout(4 * 60 + 88);
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(true); // 마지막 수단
  expect(screen.getByLabelText('숫자 0')).toBeTruthy();
});

test('키패드가 들어가면 4줄 모두 영역 안(키 x4 + 88 <= 영역)', async () => {
  await openConnect();
  const area = 4 * 66 + 88 + 3;
  await layout(area);
  const {StyleSheet} = require('react-native');
  const st = screen.getByLabelText('숫자 7').props.style;
  const k = StyleSheet.flatten(typeof st === 'function' ? st({pressed: false}) : st).minHeight as number;
  expect(4 * k + 88).toBeLessThanOrEqual(area);
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

// 실기기 예산(dp). 코드 값: 위 = max(inset, 24) + 이전 바 64, 본문 = 위 4 + 제목 두 줄(26 → 68, 22 → 58) + gap 16
// (+ 보조 문구 30 + gap 16) + 아래 8, 하단 = 위 6 + 링크 줄 64(3단계에서는 위 줄로) + 버튼 72 + 바깥 12 + max(28, 16 + inset)
const keypadArea = (H: number, insetTop: number, insetBottom: number, lv: number) => {
  const top = Math.max(insetTop, 24) + 64;
  const body = 4 + (lv >= 2 ? 58 : 68) + 16 + (lv >= 1 ? 0 : 46) + 8;
  const dock = 6 + (lv >= 3 ? 0 : 64) + 72 + 12 + Math.max(28, 16 + insetBottom);
  return H - top - body - dock;
};
const allFour = (area: number) => {
  const k = keypadKeyHeight(area);
  return k !== null && 4 * k + 88 <= area && k >= 64;
};
const firstFit = (H: number, it: number, ib: number) => [0, 1, 2, 3].find(lv => allFour(keypadArea(H, it, ib, lv)));

test('갤럭시 S25(780dp, 상단 24·하단 48): 1단계(보조 문구 숨김) 안에서 4줄 모두 들어간다', () => {
  expect(firstFit(780, 24, 48)).toBeLessThanOrEqual(1);
});

test('360x640dp 제스처 내비게이션(하단 16): 3단계까지 줄이면 4줄 모두 들어간다', () => {
  expect(firstFit(640, 24, 16)).toBeDefined();
});

test('360x640dp 3버튼 내비게이션(하단 48): 64 키로는 안 들어가 4단계(스크롤)로 잘리지 않게 한다', () => {
  expect(firstFit(640, 24, 48)).toBeUndefined();
});
