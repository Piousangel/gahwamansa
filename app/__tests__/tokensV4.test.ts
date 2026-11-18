/**
 * @jest-environment node
 */
// 토큰 v4(SUMMARY 3절 '토큰 테스트'): ① 원본 tokens-v4.json 과 생성물 일치 ② 허용 tone×면의 WCAG 대비(어르신 7, 자녀 4.5, 경계 3)
// ③ 인접 역할 크기 비율 1.2 이상(모자라면 굵기·색 보완) ④ 각 역할의 확대 상한·하한 ⑤ v3 별칭 유지·대응표.
// 대비는 원본에 적힌 숫자가 아니라 지금 색 값으로 다시 계산한다(값이 바뀌어도 테스트는 그대로).
declare const __dirname: string;
const fs: {readFileSync(p: string, e: string): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
declare const process: {execPath: string};
const {spawnSync}: {spawnSync(c: string, a: string[], o: object): {status: number | null; stderr: string; stdout: string}} = require('child_process');
// 생성기는 저장소 루트 scripts/(앱 babel 밖)라 jest 가 불러오지 않고 node 로 직접 돌린다
const ROOT = path.join(__dirname, '../..');
const SRC = path.join(ROOT, 'design-system/tokens-v4.json');
import {tokensV4 as t, type Audience} from '../src/ui/tokensV4';
import {color as v3color} from '../src/ui/tokens';
import {colorV3toV4, text20SizeToRole, typeScaleV3toV4} from '../src/ui/tokensV4Migration';
import v3 from '../../design-system/tokens-v3.json';

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
const MIN: Record<Audience, number> = {elder: t.contrastMin.elder, child: t.contrastMin.child};

describe('원본 → 생성물', () => {
  test('app/src/ui/tokensV4.ts 는 node scripts/gen-tokens-v4.js 결과와 글자까지 같다', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/gen-tokens-v4.js'), '--check'], {encoding: 'utf8'});
    expect({status: r.status, err: r.stderr.trim()}).toEqual({status: 0, err: ''});
  });
  test('원본 색 이름이 모두 생성물에 있다', () => {
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    for (const [k, v] of Object.entries(src.color as Record<string, {value?: string}>)) {
      expect([k, colors[k]]).toEqual([k, v.value]);
    }
  });
});

describe('대비(허용 목록 = 화이트리스트)', () => {
  test('허용된 글자 tone×면은 모두 audience 기준을 넘는다', () => {
    const fails: string[] = [];
    for (const p of t.textOnSurface) {
      const r = contrast(colors[p.fg], colors[p.bg]);
      const need = Math.max(...p.audience.map(a => MIN[a as Audience]));
      if (r + 1e-9 < need) {
        fails.push(`${p.fg} on ${p.bg} = ${r.toFixed(2)} < ${need} (${p.audience.join('·')})`);
      }
    }
    expect(fails).toEqual([]);
  });
  test('누를 것의 경계·아이콘(nonText)은 3:1 이상', () => {
    const fails = t.nonText
      .map(p => ({...p, r: contrast(colors[p.fg], colors[p.bg])}))
      .filter(p => p.r < t.contrastMin.nonText)
      .map(p => `${p.fg} on ${p.bg} = ${p.r.toFixed(2)}`);
    expect(fails).toEqual([]);
  });
  test('글자 역할의 기본 tone 은 종이·카드 위 허용 목록에 있다(어르신 7 / 자녀 4.5)', () => {
    const allowed = (fg: string, bg: string, a: Audience) =>
      t.textOnSurface.some(p => p.fg === fg && p.bg === bg && (p.audience as readonly string[]).includes(a));
    const missing: string[] = [];
    for (const [name, role] of Object.entries(t.type)) {
      for (const a of ['elder', 'child'] as const) {
        const spec = role[a] as {tone?: string; primary?: {tone: string}; secondary?: {tone: string}};
        const tones = spec.tone ? [spec.tone] : [spec.primary!.tone, spec.secondary!.tone];
        for (const tone of tones) {
          const bgs = tone === 'onAction' ? ['action'] : ['paper', 'card'];
          for (const bg of bgs) {
            if (!allowed(tone, bg, a)) {
              missing.push(`${name}.${a}: ${tone} on ${bg}`);
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
  test('BackLink 글자(action)는 알약 면 위에서 어르신 7 이상(면 card, 디자인 판정 11-19)', () => {
    expect(t.backLink.surface).toBe('card');
    expect(contrast(colors[t.backLink.tone], colors[t.backLink.surface])).toBeGreaterThanOrEqual(7);
  });
});

type Spec = {size: number; lineHeight: number; tone: string};
const one = (role: keyof typeof t.type, a: Audience): Spec => {
  const s = t.type[role][a] as Spec | {primary: Spec};
  return 'primary' in s ? s.primary : s;
};

describe('글자 역할', () => {
  // 위계 사슬(SUMMARY 2-1). bodyLg·body 는 쓰임이 다른 같은 층(질문 문장 / 설명 문단)이라 비율 대신 아래 목록으로 관리한다
  const CHAIN = ['display', 'title', 'heading', 'bodyLg'] as const;
  // 비율 1.2 미만인데 굵기·색도 같은 쌍 — 원본 typeRules 가 'SUMMARY 값'으로 둔 것. 늘리지 않는다(디자인 확인 대상)
  const SAME_LAYER = [['bodyLg', 'body']];
  test.each(['elder', 'child'] as const)('%s: 인접 단계는 1.2 이상이거나 굵기·색으로 보완한다', a => {
    const bad: string[] = [];
    for (let i = 0; i < CHAIN.length - 1; i++) {
      const [hi, lo] = [CHAIN[i], CHAIN[i + 1]];
      const ratio = one(hi, a).size / one(lo, a).size;
      const helped = t.type[hi].weight !== t.type[lo].weight || one(hi, a).tone !== one(lo, a).tone;
      if (ratio < 1.2 && !helped) {
        bad.push(`${hi}/${lo} ${ratio.toFixed(2)}`);
      }
    }
    expect(bad).toEqual([]);
    expect(SAME_LAYER).toHaveLength(1);
    // body 와 sub 는 크기가 같으니 색으로 구분돼야 한다
    expect(one('body', a).size).toBe(one('sub', a).size);
    expect(one('body', a).tone).not.toBe(one('sub', a).tone);
  });
  test('굵기는 400/700 두 단계(빌드 1), 본문 역할은 400', () => {
    for (const r of Object.values(t.type)) {
      expect([400, 700]).toContain(r.weight);
    }
    for (const r of ['bodyLg', 'body', 'sub', 'label'] as const) {
      expect(t.type[r].weight).toBe(400);
    }
  });
  test('확대 상한은 역할마다 1.5 또는 2.0, 고정 영역 역할(title·button·backLink·numeral)은 1.5', () => {
    for (const r of Object.values(t.type)) {
      expect([t.fontScaleCap.fixed, t.fontScaleCap.body]).toContain(r.maxFontScale);
    }
    for (const r of ['display', 'title', 'button', 'backLink', 'numeral'] as const) {
      expect(t.type[r].maxFontScale).toBe(1.5);
    }
  });
  test('글자 하한(어르신 20·자녀 16), 줄높이 ≥ 글자', () => {
    for (const [name, r] of Object.entries(t.type)) {
      for (const a of ['elder', 'child'] as const) {
        const s = r[a] as Spec | Record<string, Spec>;
        const specs = 'size' in s ? [s as Spec] : Object.values(s as Record<string, Spec>);
        for (const sp of specs) {
          expect([name, a, sp.size >= t.minFont[a]]).toEqual([name, a, true]);
          expect(sp.lineHeight).toBeGreaterThan(sp.size);
        }
      }
    }
  });
});

describe('터치·Dock·BackLink 최소값', () => {
  test('어르신 주 72·보조 64·링크 64·간격 12, 자녀 56·48', () => {
    expect(t.touch.elder).toMatchObject({primary: 72, secondary: 64, link: 64, gap: 12});
    expect(t.touch.child).toMatchObject({primary: 56, choice: 56, min: 48});
  });
  test('Dock 상한 40%, BackLink 64×120(자녀 56)', () => {
    expect(t.dock.maxHeightRatio).toBe(0.4);
    expect(t.backLink.height).toEqual({elder: 64, child: 56});
    expect(t.backLink.minWidthElder).toBe(120);
  });
  test('화면 틀 6종', () => {
    expect([...t.screenVariants].sort()).toEqual(['done', 'form', 'intro', 'list', 'state', 'step']);
  });
});

describe('v3 별칭·대응표(한 릴리스 병행, Q11)', () => {
  test('tokens.ts 의 v3 색 이름·값은 그대로다(지금 화면이 깨지지 않음)', () => {
    for (const [name, def] of Object.entries(v3.color)) {
      expect([name, (v3color as Record<string, string>)[name]]).toEqual([name, def.value]);
    }
  });
  test('대응표의 v4 이름은 모두 생성물에 있다', () => {
    for (const m of Object.values(colorV3toV4)) {
      for (const n of m.v4) {
        expect(colors[n]).toBeDefined();
      }
    }
    for (const r of [...Object.values(text20SizeToRole).map(m => m.role), ...Object.values(typeScaleV3toV4)]) {
      expect(t.type[r]).toBeDefined();
    }
  });
  test('v3 색 별칭(원본 v3Aliases): ink → action, 값은 v3 ink 와 같다', () => {
    expect(t.v3ColorAlias.ink).toBe('action');
    expect(colors[t.v3ColorAlias.ink]).toBe(v3color.ink);
  });
  test('원본 contrast-v4.py --check 와 같은 허용 목록을 읽는다(허용 목록 밖 조합 = 없음)', () => {
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const n = Object.values(src.allowed.elderText as Record<string, string[]>).flat().length + Object.values(src.allowed.childText as Record<string, string[]>).flat().length;
    expect(t.textOnSurface.reduce((s, p) => s + p.audience.length, 0)).toBe(n);
  });
});
