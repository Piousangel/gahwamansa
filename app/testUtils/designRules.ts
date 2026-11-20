// 디자인 규칙 렌더 검사 도구(RULES-V4). 화면 테스트가 screen.root 를 넘겨 쓴다.
// - R-04 굵기 집계: 700 이상 글자의 역할 이름 수. 예외는 Tag 하나(#204 리드 결정 — Tag 직계 Text 1개만)
// - R-07 accent 집계: Tag 를 센다(Tag = accent 면). v5 에서 accent 는 inkTitle 과 같은 값(#151515)이라 색 값으로는 제목·본문과 가를 수 없다 —
//   그래서 accent 쓰임은 Tag(이름 표지)로만 센다. dangerInk 글자가 같은 화면에 있는지도 본다
import {StyleSheet} from 'react-native';
import {TAG_NATIVE_ID} from '../src/ui/ds/Tag';
import {tokensV4 as t} from '../src/ui/tokensV4';

type Node = {type: unknown; props: Record<string, unknown>; children?: unknown[] | null; parent: Node | null};

const kids = (n: Node) => ((n.children ?? []).filter(c => c && typeof c === 'object') as Node[]);
function walk(n: Node, f: (x: Node) => void) {
  f(n);
  kids(n).forEach(k => walk(k, f));
}
const style = (n: Node) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;
const isTag = (n: Node) => typeof n.type === 'string' && n.props.nativeID === TAG_NATIVE_ID; // 호스트 노드만(합성 View 와 두 번 세지 않게)
const hostParent = (n: Node): Node | null => {
  let p = n.parent;
  while (p && typeof p.type !== 'string') {
    p = p.parent;
  }
  return p;
};
function insideTag(n: Node) {
  for (let p: Node | null = n; p; p = p.parent) {
    if (isTag(p)) {
      return true;
    }
  }
  return false;
}
const isText = (n: Node) => n.type === 'Text';

/** R-04 이름 예외 — 여기에 다른 것을 더하지 않는다(늘리려면 리드 결정 + RULES-V4 R-04 갱신) */
export const R04_EXEMPT = ['Tag'] as const;

/** 굵기 숫자(bold = 700). 700 이상(800·900 포함)을 굵게로 센다(#204 재확인 L2) */
const weightNum = (w: unknown) => (w === 'bold' ? 700 : typeof w === 'string' || typeof w === 'number' ? Number(w) || 400 : 400);

type Spec = {size: number; lineHeight: number};
/** 글자 크기·줄 높이로 역할 이름을 되찾는다(tokensV4 type 표, 어르신·자녀·버튼 주/보조). 표에 없으면 'size/lineHeight'.
 *  한계: 렌더 트리에는 역할 이름이 없어 값으로 되찾는다 — 두 역할의 크기·줄 높이가 같으면 한 이름(앞 것)으로 묶인다(예: 자녀 title 26/36 = 어르신 heading 26/36, 어르신 body·sub 20/30). 수는 맞고 이름만 앞 것으로 나온다(#204 재확인 L1) */
function roleName(size: number, lh: unknown): string {
  for (const [name, r] of Object.entries(t.type as unknown as Record<string, Record<string, unknown>>)) {
    for (const a of ['elder', 'child']) {
      const v = r[a] as Record<string, Spec> | Spec | undefined;
      if (!v) {
        continue;
      }
      const specs: [string, Spec][] = 'size' in v ? [[name, v as Spec]] : Object.entries(v as Record<string, Spec>).map(([k, x]) => [`${name}.${k}`, x]);
      for (const [n, x] of specs) {
        if (x.size === size && x.lineHeight === lh) {
          return n;
        }
      }
    }
  }
  return `${size}/${String(lh ?? '')}`;
}

/**
 * R-04: 화면의 굵은(700 이상) 글자 역할 이름 목록.
 * 예외는 Tag 하나 — Tag 호스트 View 의 **직계 Text 1개**만 뺀다(#204 재확인 M: Tag 안에 다른 글자를 끼워 넣어 새지 않게).
 * 대상 화면을 넓힐 때 볼 것(#204 재확인 L3): ① 화면별 audience 상한(어르신 2·자녀 3) ② 시트·대화상자는 그것만의 화면으로 따로 센다
 * ③ 글자 확대 200%에서도 같은 역할이 같은 이름으로 묶이는지(크기는 배율과 무관하게 style 값) ④ 손글씨·숫자 역할(hand·numeral)이 끼는 화면
 */
export function boldRoles(root: unknown, opts: {exemptTag?: boolean} = {}): string[] {
  const exempt = opts.exemptTag ?? true;
  const names = new Set<string>();
  const usedTag = new Set<Node>();
  walk(root as Node, n => {
    if (!isText(n)) {
      return;
    }
    const s = style(n);
    if (weightNum(s.fontWeight) < 700 || typeof s.fontSize !== 'number') {
      return;
    }
    const hp = hostParent(n);
    if (exempt && hp && isTag(hp) && !usedTag.has(hp)) {
      usedTag.add(hp); // 이 Tag 의 면제는 한 번만
      return;
    }
    names.add(roleName(s.fontSize, s.lineHeight));
  });
  return [...names];
}
export const boldRoleCount = (root: unknown, opts: {exemptTag?: boolean} = {}) => boldRoles(root, opts).length;

/** accent 쓰임 수(Tag 개수)와 dangerInk 글자 유무 */
export function accentUse(root: unknown): {accent: number; danger: boolean} {
  let accent = 0;
  let danger = false;
  walk(root as Node, n => {
    if (isTag(n)) {
      accent += 1;
    } else if (isText(n) && !insideTag(n) && style(n).color === t.color.dangerInk) {
      danger = true;
    }
  });
  return {accent, danger};
}
