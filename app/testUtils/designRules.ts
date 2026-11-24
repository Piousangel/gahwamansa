// 디자인 규칙 렌더 검사 도구(RULES-V4). 화면 테스트가 screen.root 를 넘겨 쓴다.
// - R-04 굵기 집계: 700 이상 글자의 역할 이름 수. 예외는 Tag 하나(#204 리드 결정 — Tag 직계 Text 1개만)
// - R-07 accent 집계: Tag 를 센다(Tag = accent 면). v5 에서 accent 는 inkTitle 과 같은 값(#151515)이라 색 값으로는 제목·본문과 가를 수 없다 —
//   그래서 accent 쓰임은 Tag(이름 표지)로만 센다. dangerInk 글자가 같은 화면에 있는지도 본다
// - R-22 팻말 개수: 화면당 Sign 1개. 예외는 D-4(11-24) 자녀 '지난 날' 목록 하나 — 목록 안 카드마다 1개
import {StyleSheet} from 'react-native';
import {TAG_NATIVE_ID} from '../src/ui/ds/Tag';
import {SIGN_NATIVE_ID} from '../src/ui/ds/Sign';
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
/** 역할 표지(dsRole — ds Text·Button·Tag 가 남김)가 없는 글자만 크기·줄 높이로 역할 이름을 되찾는다(tokensV4 type 표). 표에 없으면 'size/lineHeight'.
 *  한계(표지 없는 옛 글자만): 같은 크기·줄 높이의 두 역할이 하나로 묶여 수가 적게 나올 수 있다(예: 자녀 title 26/36 = 어르신 heading 26/36, 어르신 body·sub 20/30)(#204 L1) */
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
    const mark = n.props.dsRole;
    names.add(typeof mark === 'string' ? (mark === 'buttonPrimary' ? 'button.primary' : mark === 'buttonSecondary' ? 'button.secondary' : mark) : roleName(s.fontSize, s.lineHeight));
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

/** R-22 예외(D-4, DECISIONS 2026-11-24) — 자녀 C5 '지난 날' 목록(testID 정확히 일치)의 날짜 카드만. 여기에 다른 화면을 더하지 않는다(늘리려면 리드 결정 + RULES-V4 R-22 갱신) */
export const R22_LIST_EXEMPT = {list: 'child-past-list', card: 'child-past-item'} as const;

/**
 * R-22 화면당 팻말(Sign) 1개 위반 목록. 팻말은 Sign 판의 호스트 노드(nativeID 표지)로 센다.
 * - 예외 목록(R22_LIST_EXEMPT.list)의 **바로 아래(호스트 직계) 카드**(R22_LIST_EXEMPT.card)에 든 팻말은 '카드당 1개'로 따로 센다.
 *   카드 안에 카드를 또 넣어도 바깥(직계) 카드 하나로 센다(QA-1 #239 M2 — 한 날짜에 팻말 2개 우회 차단)
 * - 그 밖(목록 밖, 목록 안이지만 직계 카드 밖, 목록 없이 카드 testID 만 있는 곳)은 화면 전체에서 1개까지
 */
export function signViolations(root: unknown): string[] {
  const out: string[] = [];
  let loose = 0;
  const perCard = new Map<Node, number>();
  walk(root as Node, n => {
    if (!(typeof n.type === 'string' && n.props.nativeID === SIGN_NATIVE_ID)) {
      return;
    }
    // 가장 바깥 목록까지 올라가 그 목록의 직계 카드로 센다(#239 재확인 L-a — 카드 안에 목록·카드를 다시 넣는 우회 차단)
    let below: Node = n; // 지금 본 호스트 조상의 바로 아래 호스트 노드
    let card: Node | null = null;
    for (let p = n.parent; p; p = p.parent) {
      if (typeof p.type !== 'string') {
        continue; // 호스트 노드만(합성 컴포넌트가 같은 testID 를 물려 두 번 세지 않게)
      }
      if (p.props.testID === R22_LIST_EXEMPT.list) {
        card = below !== n && below.props.testID === R22_LIST_EXEMPT.card ? below : null; // 더 바깥 목록이 있으면 덮어쓴다
      }
      below = p;
    }
    if (card) {
      perCard.set(card, (perCard.get(card) ?? 0) + 1);
      return;
    }
    loose += 1;
  });
  if (loose > 1) {
    out.push(`화면에 팻말 ${loose}개(1개까지)`);
  }
  [...perCard.values()].forEach((k, i) => k > 1 && out.push(`지난 날 카드 ${i + 1}에 팻말 ${k}개(카드당 1개까지)`));
  return out;
}
