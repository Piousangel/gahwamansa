// R-22(v5): 노랑 #FFD43B 은 Sign(팻말)과 brand.symbol(런처·스플래시·스토어 그래픽)에서만. 그 밖의 노랑은 실패.
// ① 소스: 색 값·sign 토큰 이름을 쓰는 파일 화이트리스트 ② 렌더: 대표 화면에 Sign 밖 노랑이 없다 ③ Sign 명세
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AudienceProvider, Sign} from '../src/ui/ds';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press} from '../testUtils/flow';

const fs: {readFileSync(p: string, e: string): string; readdirSync(p: string, o: {withFileTypes: true}): {name: string; isDirectory(): boolean}[]} = require('fs');
const path: {join(...p: string[]): string; relative(a: string, b: string): string} = require('path');

const YELLOW = t.color.sign.toUpperCase();
const SRC = path.join(__dirname, '../src');
const walk = (d: string): string[] =>
  fs.readdirSync(d, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx|js)$/.test(e.name) ? [path.join(d, e.name)] : []));

test('① 소스: 노랑 값·sign 토큰 이름은 Sign.tsx 와 생성물에서만(brand.symbol 은 이름이 다른 별도 토큰)', () => {
  const ALLOW = ['ui/tokensV4.ts', 'ui/ds/Sign.tsx'];
  const hits: string[] = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f);
    if (ALLOW.includes(rel)) {
      continue;
    }
    const s = fs.readFileSync(f, 'utf8');
    if (s.toUpperCase().includes(YELLOW)) {
      hits.push(`${rel}: ${YELLOW}`);
    }
    if (/\b(color|c)\.(sign|signInk|signEdge)\b|\[['"](sign|signInk|signEdge)['"]\]/.test(s)) {
      hits.push(`${rel}: sign 토큰`);
    }
  }
  expect(hits).toEqual([]);
  expect(t.brand.symbol.toUpperCase()).toBe(YELLOW); // 같은 값이어도 이름·쓰임이 다른 토큰(R-23 조건 ②)
});

type Node = {props: Record<string, unknown>; parent: Node | null; type: unknown};
const yellowNodes = (root: Node, insideSign: (n: Node) => boolean) => {
  const out: string[] = [];
  const visit = (n: Node) => {
    const st = StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined;
    for (const k of ['color', 'backgroundColor', 'borderColor']) {
      if (typeof st?.[k] === 'string' && (st[k] as string).toUpperCase() === YELLOW && !insideSign(n)) {
        out.push(`${String(n.props.testID ?? n.type)}.${k}`);
      }
    }
  };
  const stack: Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    visit(n);
    for (const c of ((n as unknown as {children: unknown[]}).children ?? []) as unknown[]) {
      if (c && typeof c === 'object') {
        stack.push(c as Node);
      }
    }
  }
  return out;
};
const inSign = (n: Node) => {
  for (let p: Node | null = n; p; p = p.parent) {
    if (typeof p.props.testID === 'string' && /^sign/.test(p.props.testID as string)) {
      return true;
    }
  }
  return false;
};

test('② 렌더: 코스 홈·설정에 Sign 밖 노랑이 없다', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  expect(yellowNodes(screen.root as unknown as Node, inSign)).toEqual([]);
  await press('설정');
  await waitFor(() => screen.getByText('설정'));
  expect(yellowNodes(screen.root as unknown as Node, inSign)).toEqual([]);
});

describe('③ Sign 명세(R-22)', () => {
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, {includeHiddenElements: true}).props.style) as Record<string, unknown>;

  test('hero: 노랑 면 + 먹 테두리 2, 반경 3, minHeight 120, 끈·못(읽지 않음), 읽기는 readLabel', () => {
    render(<Sign size="hero" label="봄" readLabel="오늘 고르신 쪽, 봄" />);
    const b = flat('sign');
    expect(b).toMatchObject({backgroundColor: t.color.sign, borderColor: t.color.signEdge, borderWidth: t.line.sign, borderRadius: 3, minHeight: 120});
    expect(screen.getByTestId('sign').props.accessibilityLabel).toBe('오늘 고르신 쪽, 봄');
    expect(screen.getByTestId('sign-rope', {includeHiddenElements: true}).props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByText('봄').props.maxFontSizeMultiplier).toBe(1.3);
  });

  test('hero 글자는 손글씨 역할(48dp 이상 — 어르신 60·자녀 52), row 는 Noto 700 작은 글자, 끈 없음', () => {
    render(<Sign size="hero" label="봄" readLabel="r" />);
    expect(StyleSheet.flatten(screen.getByText('봄').props.style)).toMatchObject({fontSize: 60, color: t.color.signInk});
    screen.unmount();
    render(
      <AudienceProvider value="child">
        <Sign size="hero" label="가을" readLabel="r" />
      </AudienceProvider>,
    );
    expect(StyleSheet.flatten(screen.getByText('가을').props.style).fontSize).toBe(52);
    screen.unmount();
    render(<Sign size="row" label="봄" readLabel="r" />);
    expect(StyleSheet.flatten(screen.getByText('봄').props.style)).toMatchObject({fontSize: 26, fontWeight: '700'});
    expect(flat('sign').minHeight).toBe(56);
    expect(screen.queryByTestId('sign-rope', {includeHiddenElements: true})).toBeNull();
  });

  test('empty: 흰 면 + 점선(시멘트 1.5), 노랑 없음, 글자 없음', () => {
    render(<Sign size="hero" state="empty" label="" readLabel="오늘 고르실 쪽" />);
    const b = flat('sign');
    expect(b).toMatchObject({backgroundColor: t.color.card, borderStyle: 'dashed', borderWidth: t.line.border, borderColor: t.color.line});
    expect(b.backgroundColor).not.toBe(t.color.sign);
  });
});
