// 디자인 시스템·접근성 패널 r1(2026-11-20): 허용 목록(tokens-v4 allowed)이 평소 상태만 봐서 놓친 짝 — 눌림·v3 별칭도 어르신 7:1.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {Button} from '../src/ui/ds';
import {PRESSED_LOOK, type ButtonKind} from '../src/ui/ds/Button';
import {toneColor} from '../src/ui/ds/roles';
import {Text20} from '../src/ui/Text20';
import {color} from '../src/ui/tokens';
import {tokensV4 as t} from '../src/ui/tokensV4';

const colors = t.color as Record<string, string>;
function lum(hex: string): number {
  const n = hex.replace('#', '');
  const ch = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const ELDER = t.contrastMin.elder;
const ROLE: Record<ButtonKind, 'buttonPrimary' | 'buttonSecondary' | 'link'> = {primary: 'buttonPrimary', secondary: 'buttonSecondary', text: 'link', danger: 'buttonSecondary'};

test.each(['primary', 'secondary', 'text', 'danger'] as const)('ds Button %s 눌림: 글자 / 면 ≥ 7(어르신)', kind => {
  const look = PRESSED_LOOK[kind];
  const fg = toneColor(ROLE[kind], look.ink, 'elder');
  expect([kind, fg, look.bg, contrast(fg, look.bg) >= ELDER]).toEqual([kind, fg, look.bg, true]);
});

test('보조·text 눌림 글자는 tokens-v4 states.pressed 대로 actionPressed, 위험 눌림 면은 card', () => {
  expect(toneColor('buttonSecondary', PRESSED_LOOK.secondary.ink, 'elder')).toBe(colors.actionPressed);
  expect(toneColor('link', PRESSED_LOOK.text.ink, 'elder')).toBe(colors.actionPressed);
  expect(PRESSED_LOOK.danger.bg).toBe(colors.card);
});

test('눌리지 않은 보조 버튼 글자는 그대로 action(누를 수 있는 갈색)', () => {
  render(<Button kind="secondary" label="다시" onPress={() => {}} />);
  expect(StyleSheet.flatten(screen.getByText('다시').props.style).color).toBe(colors.action);
});

test('v3 inkSub(지금 화면 보조 글)는 v4 값 — paper·card·paperSoft 위 7 이상', () => {
  expect(color.inkSub).toBe(colors.inkSub);
  for (const bg of ['paper', 'card', 'paperSoft']) {
    expect([bg, contrast(color.inkSub, colors[bg]) >= ELDER]).toEqual([bg, true]);
  }
});

test('Text20 기본 글자색은 읽는 글 inkBody(차콜) — 누르는 갈색(action)이 아니다', () => {
  render(<Text20>안내 문장</Text20>);
  const c = StyleSheet.flatten(screen.getByText('안내 문장').props.style).color;
  expect(c).toBe(colors.inkBody);
  expect(c).not.toBe(colors.action);
  expect(contrast(c as string, colors.paper)).toBeGreaterThanOrEqual(ELDER);
});
