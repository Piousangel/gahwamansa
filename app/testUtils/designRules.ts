// 디자인 규칙 렌더 검사 도구(RULES-V4). 화면 테스트가 screen.root 를 넘겨 쓴다.
// - R-04 굵기 집계: 700 글자 '역할' 수(크기·줄 높이가 같으면 한 역할). 예외는 Tag 하나(#204 리드 결정 — 이름으로만)
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

/** 700 글자 역할 수(크기·줄 높이 쌍이 같으면 한 역할 — 제목 30/42 와 주 버튼 30/38 은 다른 역할). Tag 안 글자는 세지 않는다 */
export function boldRoleCount(root: unknown, opts: {exemptTag?: boolean} = {}): number {
  const exempt = opts.exemptTag ?? true;
  const sizes = new Set<string>();
  walk(root as Node, n => {
    if (!isText(n)) {
      return;
    }
    const s = style(n);
    if ((s.fontWeight === '700' || s.fontWeight === 'bold') && typeof s.fontSize === 'number' && !(exempt && insideTag(n))) {
      sizes.add(`${s.fontSize}/${String(s.lineHeight ?? '')}`);
    }
  });
  return sizes.size;
}

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
