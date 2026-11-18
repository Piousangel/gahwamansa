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

test('작은 화면(디자인 9절): 제목 22 → 약관 줄 본문 끝 → 링크도 키패드 아래(하단 고정 없음) → 키 64 + 스크롤, 안심 줄은 끝까지(U4)', async () => {
  // 기준 기기(411×914, 글자 100%)에서 측정으로 한 단계씩(jest 모의 기본 글자 배율은 2라 처음부터 2단계가 된다)
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 411, height: 914, scale: 2.6, fontScale: 1});
  await openConnect();
  expect(screen.getByTestId('connect-safe')).toBeTruthy();
  await layout(4 * 60 + 104);
  expect(screen.getByTestId('connect-safe')).toBeTruthy(); // UX U4: 안심 줄은 줄어들어도 남는다
  const {StyleSheet} = require('react-native');
  expect(StyleSheet.flatten(screen.getByRole('header').props.style).fontSize).toBe(22);
  await layout(4 * 60 + 104);
  // 2단계: 약관 줄은 본문 끝, 링크는 아직 하단 고정
  expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
  expect(within(screen.getByTestId('screen-dock')).getByTestId('connect-links')).toBeTruthy();
  await layout(4 * 60 + 104);
  expect(screen.queryByTestId('screen-dock')).toBeNull(); // 3단계: 하단 고정 없음(감사 H3), 링크도 키패드 아래
  expect(within(screen.getByTestId('screen-body')).getByTestId('connect-links')).toBeTruthy();
  await layout(4 * 60 + 104);
  expect(screen.getByTestId('screen-body').props.scrollEnabled).toBe(true); // 4단계: 마지막 수단
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

// 디자인 판정 9절 H3 예산(가용 높이, dp): 3단계(하단 고정 없음) = 상단 64 + 제목 22 한 줄 32 + 안심 2줄 60 + 간격 12×4
// + 칸 68 + 12 + 칸 아래 34 + 키 4×64 + 3×6 = 592 → 360×640(가용 약 600)에서 키 12개 전부. 기기별 실제 단계는 측정(onLayout)이 정하고
// S25 0·360×740 1·320×640 4단계는 에뮬레이터 감사(audit-points)로 확인한다
test('디자인 9절 H3: 360×640 가용 600 안에 3단계 묶음(키 64) 592 가 들어간다', () => {
  const stage3 = 64 + 32 + 60 + 12 * 4 + 68 + 12 + 34 + 4 * 64 + 3 * 6;
  expect(stage3).toBe(592);
  expect(stage3).toBeLessThanOrEqual(600);
  expect(keypadKeyHeight(4 * 64 + 104)).toBe(64);
});

const StyleSheetFlat = (st: unknown) => require('react-native').StyleSheet.flatten(st);

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
        // 측정 전에도 2단계(약관 줄 본문): 하단 고정이 키패드를 가리는 첫 화면을 그리지 않는다
        expect(within(screen.getByTestId('screen-body')).getByTestId('legal-line')).toBeTruthy();
        await layout(4 * 60 + 104); // 감사 재현: 키 4줄이 남은 높이에 안 들어감
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

  test('M6: 글자 키(모두 지움)는 어절 단위로만 줄바꿈(Android 는 음절 사이 WJ), 글자 22 이상', async () => {
    const {keepAllChildren} = require('../src/ui/koreanText');
    expect(keepAllChildren('모두 지움', 'android')).toBe('모\u2060두 지\u2060움');
    await openConnect();
    const k = screen.getByTestId('key-모두 지움');
    expect(k.props.lineBreakStrategyIOS).toBe('hangul-word');
    expect(StyleSheetFlat(k.props.style).fontSize).toBeGreaterThanOrEqual(22);
  });
});
