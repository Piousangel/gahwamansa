import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {DateStamp} from '../src/ui/ds';
import {ds} from '../src/ui/ds/roles';

// D-2(DECISIONS 2026-11-24 오너 전면 위임): P3 '했어요' 옆 ✓ → 먹 두 겹 원 날짜 도장('24일').
// 시안 docs/design/2026-11-24-d2-d3-c4/d2-done-mark.html ①안: 지름 56, '24일' 20/700, −3° 고정, 확대 상한 1.3(200% 지름 73).
// 조건: '했어요'·도장·› 한 묶음으로 늘 오른쪽, 200%에서 줄이 넘어가도 원이 줄 머리(왼쪽)에 오지 않는다(라디오 오해 방지).

const kstDay = () => new Date(Date.now() + 9 * 3600e3).getUTCDate(); // 시험이 화면 코드와 따로 계산(같은 함수를 빌리지 않는다)
const STEPS = ['사진 보기', '둘 중 고르기', '낱말 쓰기'];
const RN = require('react-native');
const flat = (s: unknown) => StyleSheet.flatten(s as never) ?? {};

afterEach(() => jest.restoreAllMocks());

describe('토큰: stampInk = 먹 별칭', () => {
  test('stampInk 는 새 색이 아니라 inkTitle(먹) 값, 글자 역할 stampLabel 20/700 상한 1.3', () => {
    expect(ds.color.stampInk).toBe(ds.color.inkTitle);
    expect(ds.type.stampLabel.elder).toMatchObject({size: 20, tone: 'stampInk'});
    expect(ds.type.stampLabel.weight).toBe(700);
    expect(ds.type.stampLabel.maxFontScale).toBe(1.3);
  });
});

describe('DateStamp 부품', () => {
  const dims = (fontScale: number) => jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale});

  test('100%: 지름 64 두 겹 원(먹 선), 안에 글자, −3° 고정, 화면 읽기에서 숨김(행이 날짜를 읽는다)', () => {
    dims(1);
    render(<DateStamp label="24일" testID="st" />);
    const outer = screen.getByTestId('st', {includeHiddenElements: true});
    const o = flat(outer.props.style);
    expect(o.width).toBe(64);
    expect(o.height).toBe(64);
    expect(o.borderRadius).toBe(32);
    expect(o.borderColor).toBe(ds.color.stampInk);
    expect(o.transform).toEqual([{rotate: '-3deg'}]);
    const inner = flat(screen.getByTestId('st-inner', {includeHiddenElements: true}).props.style);
    expect(inner.borderColor).toBe(ds.color.stampInk);
    const text = screen.getByText('24일', {includeHiddenElements: true});
    expect(flat(text.props.style)).toMatchObject({fontSize: 20, fontWeight: '700', color: ds.color.stampInk});
    expect(text.props.maxFontSizeMultiplier).toBe(1.3);
    expect(outer.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(outer.props.accessibilityElementsHidden).toBe(true);
  });

  test('200%: 지름이 글자를 따라 커지되 상한 1.3(지름 83), 115%는 그 사이(74)', () => {
    dims(2);
    const {rerender} = render(<DateStamp label="24일" testID="st" />);
    expect(flat(screen.getByTestId('st', {includeHiddenElements: true}).props.style).width).toBe(83);
    jest.restoreAllMocks();
    dims(1.15);
    rerender(<DateStamp label="24일" testID="st" />);
    expect(flat(screen.getByTestId('st', {includeHiddenElements: true}).props.style).width).toBe(74);
  });

  // 리드 결정(11-25, 캡처 04): 글자는 최소 20 유지, 지름을 키워 안쪽 원과 글자 잉크 사이 여백 4dp 이상.
  // 글자 잉크 상자는 에뮬레이터 실측(360×640 100%, 2.75px/dp): '25일' 20/700 = 폭 39 × 높이 18dp.
  // 숫자는 tabular-nums(칸 폭이 같다)라 '31일'(가장 넓은 날짜로 친 값)도 같은 상자로 본다 — '1'의 잉크가 더 좁아 보수적인 값.
  // 여백 = 안쪽 원 안 반지름 − 원 중심에서 잉크 상자 모서리까지 거리(모서리가 가장 먼저 닿는다).
  const INK = {'25일': {w: 39, h: 18}, '31일': {w: 39, h: 18}};
  test.each(Object.keys(INK))("'%s' 잉크 상자와 안쪽 원 사이 여백 4dp 이상(100%·200% 모두)", label => {
    for (const fontScale of [1, 2]) {
      jest.restoreAllMocks();
      dims(fontScale);
      const {unmount} = render(<DateStamp label={label} testID="st" />);
      const d = flat(screen.getByTestId('st', {includeHiddenElements: true}).props.style).width as number;
      const inner = flat(screen.getByTestId('st-inner', {includeHiddenElements: true}).props.style);
      const ring = flat(screen.getByTestId('st', {includeHiddenElements: true}).props.style).borderWidth as number;
      const innerR = d / 2 - ring - (inner.top as number) - (inner.borderWidth as number);
      const k = Math.min(fontScale, 1.3); // 글자도 같은 상한으로 커진다
      const ink = INK[label as keyof typeof INK];
      const corner = Math.hypot((ink.w * k) / 2, (ink.h * k) / 2);
      expect(innerR - corner).toBeGreaterThanOrEqual(4);
      unmount();
    }
  });
});

describe('P3 다 마친 행', () => {
  async function home() {
    render(<AppRoot api={createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question', 'hangul']})} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
  }

  test("화면 읽기는 사실만: '사진 보기, 했어요, 24일'(칭찬 문구 없음), 힌트 '다시 보기'", async () => {
    await home();
    for (const n of STEPS) {
      const row = screen.getByRole('button', {name: `${n}, 했어요, ${kstDay()}일`});
      expect(row.props.accessibilityHint).toBe('다시 보기');
    }
  });

  test('✓ 대신 날짜 도장: 행마다 도장 1개(오늘 날짜), 체크 아이콘 없음', async () => {
    await home();
    for (const step of ['photo', 'question', 'hangul']) {
      const row = screen.getByTestId(`step-done-${step}`);
      expect(within(row).queryByTestId('icon-check', {includeHiddenElements: true})).toBeNull();
      expect(within(row).getAllByTestId('done-stamp', {includeHiddenElements: true})).toHaveLength(1);
      expect(within(row).getByText(`${kstDay()}일`, {includeHiddenElements: true})).toBeTruthy();
    }
  });

  test("'했어요'·도장·› 한 묶음: 순서 그대로, 묶음은 줄바꿈하지 않고 오른쪽에 붙는다(200%에서 내려가도 도장이 줄 머리에 오지 않음)", async () => {
    await home();
    const row = screen.getByTestId('step-done-photo');
    const group = within(row).getByTestId('done-status', {includeHiddenElements: true});
    const g = flat(group.props.style);
    expect(g.flexDirection).toBe('row');
    expect(g.flexWrap ?? 'nowrap').toBe('nowrap'); // 묶음 안에서 갈라지지 않는다 → 도장 앞에는 늘 '했어요'
    expect(g.marginLeft).toBe('auto'); // 이름 줄에 못 들어가 다음 줄로 내려가도 오른쪽 끝
    expect(g.flexShrink).toBe(0);
    // 순서: 했어요 → 도장 → ›
    const ORDER = ['done-label', 'done-stamp', 'icon-chevron-right'];
    const kids = [...new Set(group.findAll(n => typeof n.type === 'string' && ORDER.includes(n.props.testID)).map(n => n.props.testID as string))];
    expect(kids).toEqual(ORDER);
    // 행 줄: 이름과 묶음이 한 줄에 안 들어가면 줄바꿈(wrap), 이름은 남는 폭을 채운다
    const line = flat(within(row).getByTestId('done-line', {includeHiddenElements: true}).props.style);
    expect(line.flexWrap).toBe('wrap');
  });
});
