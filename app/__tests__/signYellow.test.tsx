// R-22(v5): 노랑 #FFD43B 은 Sign(팻말)과 brand.symbol(런처·스플래시·스토어 그래픽)에서만. 그 밖의 노랑은 실패.
// ① 소스: 색 값·sign 토큰 이름을 쓰는 파일 화이트리스트 ② 렌더: 대표 화면에 Sign 밖 노랑이 없다 ③ Sign 명세
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AudienceProvider, Sign} from '../src/ui/ds';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press, pressCourseNext} from '../testUtils/flow';
import {signViolations} from '../testUtils/designRules';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

const fs: {readFileSync(p: string, e: string): string; readdirSync(p: string, o: {withFileTypes: true}): {name: string; isDirectory(): boolean}[]} = require('fs');
const path: {join(...p: string[]): string; relative(a: string, b: string): string} = require('path');

const YELLOW = t.color.sign.toUpperCase();
const [YR, YG, YB] = [1, 3, 5].map(i => parseInt(YELLOW.slice(i, i + 2), 16));
// 노랑을 쓰는 모든 표기(#179 리뷰 M3): hex(대소문자·3자리 없음), rgb()/rgba() 정수 표기
const YELLOW_RE = new RegExp(`${YELLOW.slice(1)}|rgba?\\(\\s*${YR}\\s*,\\s*${YG}\\s*,\\s*${YB}\\b`, 'i');
const SRC = path.join(__dirname, '../src');
const ROOTS = [SRC, path.join(__dirname, '../android/app/src/main/res'), path.join(__dirname, '../../design-system/assets')];
const walk = (d: string): string[] => {
  try {
    return fs.readdirSync(d, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx|js|json|svg|xml)$/.test(e.name) ? [path.join(d, e.name)] : []));
  } catch {
    return [];
  }
};
/** 노랑·sign 토큰 쓰는 곳(화이트리스트 밖) */
export function yellowHits(files: {rel: string; text: string}[]): string[] {
  const ALLOW = ['src/ui/tokensV4.ts', 'src/ui/ds/Sign.tsx'];
  const hits: string[] = [];
  for (const {rel, text} of files) {
    if (ALLOW.includes(rel)) {
      continue;
    }
    if (YELLOW_RE.test(text)) {
      hits.push(`${rel}: 노랑 값`);
    }
    // sign 토큰: 점 접근·대괄호·구조 분해({sign} = …color)
    if (/\b(color|c)\.(sign|signInk|signEdge)\b|\[['"](sign|signInk|signEdge)['"]\]|\{[^}]*\b(signInk|signEdge|sign)\b[^}]*\}\s*=\s*[\w.]*color\b/.test(text)) {
      hits.push(`${rel}: sign 토큰`);
    }
  }
  return hits;
}

test('① 소스: 노랑(hex·rgb)·sign 토큰은 Sign.tsx 와 생성물에서만 — src·android res·design-system 에셋의 ts·json·svg·xml(brand.symbol 은 이름이 다른 별도 토큰)', () => {
  const root = path.join(__dirname, '../..');
  const files = ROOTS.flatMap(walk).map(f => ({rel: path.relative(path.join(root, 'app'), f).replace(/^\.\.\//, ''), text: fs.readFileSync(f, 'utf8')}));
  expect(files.length).toBeGreaterThan(100);
  expect(yellowHits(files)).toEqual([]);
  expect(t.brand.symbol.toUpperCase()).toBe(YELLOW); // 같은 값이어도 이름·쓰임이 다른 토큰(R-23 조건 ②)
});

type Node = {props: Record<string, unknown>; parent: Node | null; type: unknown};
const yellowNodes = (root: Node, insideSign: (n: Node) => boolean) => {
  const out: string[] = [];
  const visit = (n: Node) => {
    const st = StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined;
    for (const k of ['color', 'backgroundColor', 'borderColor', 'tintColor']) {
      if (typeof st?.[k] === 'string' && YELLOW_RE.test(st[k] as string) && !insideSign(n)) {
        out.push(`${String(n.props.testID ?? n.type)}.${k}`);
      }
    }
    for (const k of ['fill', 'stroke', 'color']) {
      if (typeof n.props[k] === 'string' && YELLOW_RE.test(n.props[k] as string) && !insideSign(n)) {
        out.push(`${String(n.props.testID ?? n.type)}.${k}(속성)`);
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
// 면제는 Sign 컴포넌트 루트(testID 'sign' 또는 'sign-…' 정확히, 그리고 Sign 이 그린 노드)에만(#179 리뷰 M3) — 'signup' 같은 이름은 면제되지 않는다
const inSign = (n: Node) => {
  for (let p: Node | null = n; p; p = p.parent) {
    if (typeof p.props.testID === 'string' && /^sign(-wrap|-rope)?$/.test(p.props.testID as string)) {
      return true;
    }
  }
  return false;
};

test('② 렌더: 첫 화면·코스 홈·P4·설정·자녀 홈에 Sign 밖 노랑이 없고 팻말은 화면당 1개 이하', async () => {
  const seen: Record<string, string[]> = {};
  // R-22 화면당 팻말 1개도 같은 화면에서 센다(예외는 자녀 지난 날 목록 카드만 — __tests__/childPastSignPair)
  const look = (k: string) => (seen[k] = [...yellowNodes(screen.root as unknown as Node, inSign), ...signViolations(screen.root)]);
  render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  look('첫 화면');
  screen.unmount();
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  look('코스 홈');
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  look('P4');
  screen.unmount();
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => screen.getByText('설정'));
  look('설정');
  screen.unmount();
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마'})} role="child" />);
  await waitFor(() => expect(screen.getByRole('button', {name: '응원 보내기'})).toBeEnabled()); // 불러오는 중의 꺼진 버튼이 아니라 켜진 버튼(대기열 46)
  look('자녀 홈');
  expect(seen).toEqual({'첫 화면': [], '코스 홈': [], P4: [], 설정: [], '자녀 홈': []});
});

describe('일부러 넣은 위반을 잡는다(#179 리뷰 M3)', () => {
  test('소스: 소문자 hex·rgb 표기·대괄호·구조 분해·svg 속성', () => {
    const files = [
      {rel: 'src/a.ts', text: "const y = '#ffd43b';"},
      {rel: 'src/b.ts', text: 'const y = "rgb(255, 212, 59)";'},
      {rel: 'src/c.ts', text: "const y = ds.color['signInk'];"},
      {rel: 'src/d.ts', text: 'const {sign} = tokensV4.color;'},
      {rel: 'res/e.svg', text: '<rect fill="#FFD43B"/>'},
      {rel: 'src/ui/ds/Sign.tsx', text: 'c.sign'}, // 화이트리스트
    ];
    expect(yellowHits(files).map(h => h.split(':')[0])).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'res/e.svg']);
  });
  test("렌더: Sign 밖 노랑 면·svg fill, 'signup' testID 는 면제되지 않는다", () => {
    const {View} = require('react-native');
    const Svg = require('react-native-svg').default;
    const {Rect} = require('react-native-svg');
    render(
      <View>
        <View testID="signup" style={{backgroundColor: '#ffd43b'}} />
        <Svg width={10} height={10}>
          <Rect width={10} height={10} fill="#FFD43B" />
        </Svg>
        <Sign size="row" label="봄" readLabel="r" />
      </View>,
    );
    const hits = yellowNodes(screen.root as unknown as Node, inSign);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some(h => h.startsWith('signup'))).toBe(true);
    expect(hits.some(h => h.includes('fill'))).toBe(true);
    expect(hits.some(h => /^sign\./.test(h))).toBe(false); // Sign 자신은 면제
  });
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
