// C4 호칭 겹침(시안 C4_title_dup): 두 번째 어르신이 연결되면 가족 기본 호칭을 물려받아 같은 이름이 둘이 된다(서버 0028).
// 순수 함수: 겹친 이름 중 나중에 연결된 분(목록 뒤쪽, child_summary 는 연결 순서)을 바꿀 대상으로, 다른 분들 이름은 고를 수 없게.
import type {ChildParent} from '../types';

export type TitleDup = {target: ChildParent; taken: string[]};

export function findTitleDup(parents: ChildParent[]): TitleDup | null {
  const seen = new Set<string>();
  let target: ChildParent | null = null;
  for (const p of parents) {
    if (p.parentId && seen.has(p.title)) {
      target = p; // 마지막으로 겹친 분(가장 나중에 연결)
    }
    seen.add(p.title);
  }
  if (!target) {
    return null;
  }
  const t = target;
  return {target: t, taken: [...new Set(parents.filter(p => p.parentId !== t.parentId).map(p => p.title))]};
}
