/**
 * 접힘 경계 맞춤 계산 하나(RULES-V4 R-15 '모든 배율에서 접힘 경계는 줄·요소 경계'). ui/FoldStack(어르신 P4·P5)과
 * ui/ds useFoldGap(자녀 C3·C4)이 같이 쓴다(PR #91 리뷰 L1 — 두 곳에 같은 계산을 두지 않는다).
 *
 * 첫 화면 끝(viewport, 스크롤 내용 좌표)에 걸치는 첫 요소를 찾아 그 요소 위에 넣을 여백(space)을 돌려준다.
 * - 높이는 자연 높이(넣은 여백 제외)로 쌓아 계산한다 — 넣은 여백이 다시 판정을 흔들지 않는다.
 * - 높이를 아직 모르는 요소가 있거나 viewport 를 모르면(0) null.
 * - 경계 동작(테스트 foldPush.test.ts 로 고정):
 *   ① 한 화면보다 큰 요소는 밀지 않는다(밀어도 또 잘린다 → 그대로 두고 스크롤로 닿게).
 *   ② 묶음 첫 요소는 allowFirst 일 때만 민다(첫 요소 앞 여백 = 묶음 전체를 미는 것. 하위 줄 묶음·단계 묶음은 켠다).
 *   ③ from 보다 앞 번호는 밀지 않는다(첫 화면에 남기는 것이 시안인 요소, 예: C4 안내 한 줄).
 *   ④ glue 번호(묶음 제목 등)는 다음 요소와 붙여 민다 — 다음 요소가 걸리면 제목째(첫 화면 끝에 제목만 남지 않게, PR #83 재확인 L9).
 *   ⑤ pushTo(기본 viewport): 민 요소의 위 끝이 갈 곳. 내용 위에 겹쳐 그리는 흐림이 있는 옛 Screen 은 판정 = 창 − 흐림, pushTo = 창 끝(지금 쓰는 화면 없음 — C4 홈은 DsScreen 으로 옮김).
 *      흐림 구간(viewport ~ pushTo) 안에서 시작해 viewport 아래로 걸치는 요소도 민다(PR #87 L4·재확인 L6).
 */
export type FoldPushOptions = {allowFirst?: boolean; from?: number; glue?: readonly number[]; pushTo?: number};
export type FoldPush = {index: number; space: number};

export function foldPush(
  viewport: number,
  top: number,
  heights: readonly (number | undefined)[],
  gap: number,
  opts: boolean | FoldPushOptions = {},
): FoldPush | null {
  const {allowFirst = false, from = 0, glue = [], pushTo = viewport} = typeof opts === 'boolean' ? {allowFirst: opts} : opts;
  if (viewport <= 0 || heights.some(h => h === undefined)) {
    return null;
  }
  const to = Math.max(viewport, pushTo);
  const tops: number[] = [];
  let y = top;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i] as number;
    if (i > 0) {
      y += gap;
    }
    tops.push(y);
    const bottom = y + h;
    if (y >= to) {
      return null; // 이미 접힘 밖
    }
    if (bottom > viewport + 0.5) {
      if (i < from || h >= viewport) {
        return null;
      }
      // 제목째: 앞 요소가 glue 면 그 앞에 넣는다(제목도 밀 수 있는 번호일 때만)
      const target = i - 1 >= from && glue.includes(i - 1) ? i - 1 : i;
      if (target === 0 && !allowFirst) {
        return null;
      }
      return {index: target, space: Math.ceil(to - tops[target]) + 1};
    }
    y = bottom;
  }
  return null;
}
