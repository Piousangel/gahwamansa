// C-4 자녀 '지난 날' 두 칸 나란히(D-4, 시안 docs/design/2026-11-24-d2-d3-c4 안 1)
// - 날짜 카드마다 A 왼쪽·B 오른쪽(원래 순서), 고른 칸 = 노랑 팻말(row), 안 고른 칸 = 면 없음 + 옅은 선 1.5 + inkSubChild 16/400, 확대 상한 1.5
// - 200%(fontScale ≥ 1.5)에서는 위아래로 쌓는다(A 위, B 아래)
// - R-22 '화면당 팻말 1개'는 지난 날 목록(child-past-list 안의 child-past-item 카드)만 '카드당 1개'로 예외. 다른 화면·다른 자리로 새지 않는다
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {Sign} from '../src/ui/ds';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {signViolations} from '../testUtils/designRules';

const ITEMS = [
  {answeredDate: '2020-11-24', promptShort: '곱게 차려입기와 편하게 입기 중', optionA: '곱게 차려입기', optionB: '편하게 입기', choiceLabel: '곱게 차려입기'},
  {answeredDate: '2020-11-23', promptShort: '국밥과 칼국수 중', optionA: '국밥', optionB: '칼국수', choiceLabel: '칼국수'},
  // 11-22 는 답 없는 날 — 서버가 주지 않으니 카드도 없다(U6)
  {answeredDate: '2020-11-21', promptShort: '짐은 가볍게와 짐은 넉넉히 중', optionA: '짐은 가볍게', optionB: '짐은 넉넉히', choiceLabel: '짐은 가볍게'},
];

// 글자 배율: jest 기본은 2 — 화면 테스트마다 정한다(모듈째 바꾼다, auditFixes 와 같은 방식)
let mockDims = {width: 360, height: 640, scale: 2.75, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));
const setScale = (fontScale: number) => {
  mockDims = {...mockDims, fontScale};
};

async function openPast(items: object[] = ITEMS) {
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', history: items as never})} role="child" />);
  await waitFor(() => screen.getByRole('tab', {name: '지난 날'}));
  fireEvent.press(screen.getByRole('tab', {name: '지난 날'}));
  await waitFor(() => expect(screen.getAllByTestId('child-past-item')).toHaveLength(items.length));
  return screen.getAllByTestId('child-past-item');
}
const flat = (n: {props: {style?: unknown}}) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;
const textOf = (n: unknown) => {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === 'string') {
      out.push(x);
    } else if (x && typeof x === 'object') {
      ((x as {children?: unknown[]}).children ?? []).forEach(walk);
    }
  };
  walk(n);
  return out.join('').replace(/⁠/g, '');
};

afterEach(() => setScale(1));

describe('C-4 두 칸 나란히', () => {
  test('카드마다 팻말 1개(고른 쪽)·흐린 칸 1개(다른 쪽), A 왼쪽·B 오른쪽 순서 그대로', async () => {
    setScale(1);
    const cards = await openPast();
    cards.forEach((card, i) => {
      const it = ITEMS[i];
      expect(within(card).getAllByTestId('sign')).toHaveLength(1);
      expect(within(card).getAllByTestId('sign-other')).toHaveLength(1);
      // 순서: 트리 순서대로 a 칸, b 칸
      expect(within(card).getAllByTestId(/^pair-[ab]$/).map(n => n.props.testID)).toEqual(['pair-a', 'pair-b']);
      expect(textOf(within(card).getByTestId('pair-a'))).toBe(it.optionA);
      expect(textOf(within(card).getByTestId('pair-b'))).toBe(it.optionB);
      const chosen = it.choiceLabel === it.optionA ? 'pair-a' : 'pair-b';
      const other = chosen === 'pair-a' ? 'pair-b' : 'pair-a';
      expect(within(within(card).getByTestId(chosen)).getByTestId('sign')).toBeTruthy();
      expect(within(within(card).getByTestId(other)).getByTestId('sign-other')).toBeTruthy();
    });
    // 화면 읽기: 카드 한 줄(날짜·질문·고른 답) 그대로
    expect(screen.getByLabelText('2020년 11월 23일, 국밥과 칼국수 중, 고른 답 칼국수')).toBeTruthy();
  });

  test('고른 칸 = 팻말 row(노랑 + 먹 테두리 2·반경 3, 글자 20/700 상한 1.5), 안 고른 칸 = 면 없음·옅은 선 1.5·inkSubChild 16/400 상한 1.5', async () => {
    setScale(1);
    const [card] = await openPast();
    const sign = within(card).getByTestId('sign');
    expect(flat(sign)).toMatchObject({backgroundColor: t.color.sign, borderColor: t.color.signEdge, borderWidth: 2, borderRadius: 3, minHeight: 56});
    const signText = within(card).getByText('곱게 차려입기');
    expect(flat(signText)).toMatchObject({fontSize: 20, fontWeight: '700', color: t.color.signInk});
    expect(signText.props.maxFontSizeMultiplier).toBe(1.5);

    const ghost = within(card).getByTestId('sign-other');
    const g = flat(ghost);
    expect(g).toMatchObject({borderColor: t.color.lineSoft, borderWidth: 1.5, borderRadius: 3, minHeight: 56});
    expect(g.backgroundColor ?? 'transparent').toBe('transparent'); // 면 없음(불투명도로 흐리게 하지 않는다)
    expect(g.opacity ?? 1).toBe(1);
    const otherText = within(card).getByText('편하게 입기');
    expect(flat(otherText)).toMatchObject({fontSize: 16, fontWeight: '400', color: t.color.inkSubChild});
    expect(otherText.props.maxFontSizeMultiplier).toBe(1.5); // sub 기본 2.0 이 아니라 팻말 글자와 같은 1.5(위계 뒤집힘 방지)
  });

  test('100%는 두 칸 가로, 200%는 위아래로 쌓되 A 위·B 아래 순서 유지', async () => {
    setScale(1);
    let [card] = await openPast();
    expect(flat(within(card).getByTestId('child-past-pair')).flexDirection).toBe('row');
    screen.unmount();
    setScale(2);
    [card] = await openPast();
    expect(flat(within(card).getByTestId('child-past-pair')).flexDirection).toBe('column');
    expect(within(card).getAllByTestId(/^pair-[ab]$/).map(n => n.props.testID)).toEqual(['pair-a', 'pair-b']);
    expect(within(card).getAllByTestId('sign')).toHaveLength(1);
  });

  test('R-22 예외: 지난 날 목록은 카드당 1개라 팻말이 셋이어도 위반 없음', async () => {
    setScale(1);
    await openPast();
    expect(screen.getAllByTestId('sign')).toHaveLength(3);
    expect(signViolations(screen.root)).toEqual([]);
  });

  test('보기 두 개가 없는 옛 응답이면 고른 답 팻말만(흐린 칸 없음)', async () => {
    setScale(1);
    const [card] = await openPast([{answeredDate: '2020-11-16', promptShort: '봄과 가을 중', choiceLabel: '가을'}]);
    expect(within(card).getAllByTestId('sign')).toHaveLength(1);
    expect(within(card).queryByTestId('sign-other')).toBeNull();
    expect(within(card).getByText('가을')).toBeTruthy();
  });
});

describe('R-22 예외가 다른 자리로 새지 않는다(signViolations)', () => {
  const two = (
    <>
      <Sign size="row" label="봄" readLabel="r" />
      <Sign size="row" label="가을" readLabel="r" />
    </>
  );
  test('예외 목록 밖 한 화면에 팻말 2개 → 위반', () => {
    render(<View testID="child-past">{two}</View>);
    expect(signViolations(screen.root)).not.toEqual([]);
  });
  test('카드 testID 라도 목록(child-past-list) 밖이면 → 위반', () => {
    render(<View testID="child-past-item">{two}</View>);
    expect(signViolations(screen.root)).not.toEqual([]);
  });
  test('비슷한 이름(child-past-list-x)은 예외 아님 → 위반', () => {
    render(
      <View testID="child-past-list-x">
        <View testID="child-past-item">{two}</View>
      </View>,
    );
    expect(signViolations(screen.root)).not.toEqual([]);
  });
  test('목록 안이라도 한 카드에 팻말 2개 → 위반', () => {
    render(
      <View testID="child-past-list">
        <View testID="child-past-item">{two}</View>
      </View>,
    );
    expect(signViolations(screen.root)).not.toEqual([]);
  });
  test('목록 카드 셋(각 1개)은 통과, 목록 밖 팻말은 따로 화면당 1개로 센다', () => {
    const card = (k: string) => (
      <View testID="child-past-item" key={k}>
        <Sign size="row" label={k} readLabel="r" />
      </View>
    );
    render(<View testID="child-past-list">{['a', 'b', 'c'].map(card)}</View>);
    expect(signViolations(screen.root)).toEqual([]);
    screen.unmount();
    render(
      <View>
        <Sign size="hero" label="봄" readLabel="r" />
        <View testID="child-past-list">{['a', 'b'].map(card)}</View>
        <Sign size="row" label="여름" readLabel="r" />
      </View>,
    );
    expect(signViolations(screen.root)).not.toEqual([]); // 목록 밖 2개
  });
});
