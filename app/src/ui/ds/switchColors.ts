import {ds} from './roles';

/**
 * 켬·끔 스위치 색(자녀·어르신 공통, PR #100 리뷰 L2). 꺼진 트랙도 흰 면·종이 위에서 비텍스트 대비 3:1 이상(WCAG 1.4.11):
 * - 끔 트랙 line #A67C5A — 흰 면 3.72 · 종이 3.36(이전 lineSoft 1.44 는 미달)
 * - 켬 트랙 done #166534 — 흰 면 7.13, 손잡이 card(흰)
 * 켬·끔은 색만이 아니라 손잡이 위치로도 구분된다(스위치 기본 모양).
 */
export const SWITCH_COLORS = {
  trackColor: {false: ds.color.line, true: ds.color.done},
  thumbColor: ds.color.card,
} as const;
