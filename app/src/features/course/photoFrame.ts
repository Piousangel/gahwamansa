/**
 * P4 사진 틀 크기(오너 S25 피드백 11-24: 고정 높이 80~124 + cover 라 사진이 가로 띠처럼 잘렸다).
 * 사진은 원본 비율 그대로 보여 준다 — 잘라 내지 않는다.
 * - 틀 폭 = 본문 폭, 높이 = 폭 ÷ 비율.
 * - 높이 상한은 두 가지 중 작은 값. 넘는 사진은 높이를 상한으로 두고 폭을 같은 비율로 줄인다(가운데, 잘림 없음).
 *   ① 창 높이 45%(리드 결정 #234 M2: 콘텐츠 가로 사진은 그대로, 정사각·세로 사진만 작아짐)
 *   ② fit(있을 때): 첫 화면에 질문 첫 문장까지 들게 하는 높이(화면이 viewport 실측으로 계산, 글자 150% 미만만).
 *      단 ②는 바닥(photoFloor) 아래로 내리지 않는다 — 작은 화면에서는 사진을 우선하고 질문은 접힘 아래로 간다(오너 '크게').
 * - 비율을 아직 모르면(불러오기 전·준비 중·실패) 콘텐츠 사진 비율(1152×928) 틀 — 불러온 뒤 튀지 않게(#234 L1).
 */
export const PHOTO_CONTENT_ASPECT = 1152 / 928;
/** 창 높이 대비 사진 높이 상한 */
export const PHOTO_MAX_HEIGHT_RATIO = 0.45;
/** fit 바닥: 폭의 50%(가로 2:1보다 납작한 띠로 줄이지 않는다 — 고친 결함이 약 3.5:1 띠) 또는 160dp(옛 고정 틀 최대 124보다 크게) 중 큰 값 */
export const PHOTO_FLOOR_MIN = 160;
export const PHOTO_FLOOR_WIDTH_RATIO = 0.5;
/** fit 여유: 실기기 dp 반올림으로 질문 첫 문장 바닥이 1~2dp 넘치면(foldPush 허용 0.5) 문장이 통째로 접힘 아래로 밀린다(#234 재확인 L1) */
export const PHOTO_FIT_SLACK = 2;

export type PhotoFrame = {width: number; height: number};

export function photoAspect(w?: number, h?: number): number | null {
  return w && h && w > 0 && h > 0 && Number.isFinite(w / h) ? w / h : null;
}

export function photoFloor(boxWidth: number): number {
  return Math.max(PHOTO_FLOOR_MIN, Math.round(boxWidth * PHOTO_FLOOR_WIDTH_RATIO));
}

export function photoFrame(boxWidth: number, aspect: number | null, windowHeight: number, fit?: number): PhotoFrame {
  if (!(boxWidth > 0)) {
    return {width: 0, height: 0};
  }
  const ratio = aspect && aspect > 0 && Number.isFinite(aspect) ? aspect : PHOTO_CONTENT_ASPECT;
  const caps: number[] = [];
  if (windowHeight > 0) {
    caps.push(Math.round(windowHeight * PHOTO_MAX_HEIGHT_RATIO));
  }
  if (fit !== undefined && Number.isFinite(fit)) {
    caps.push(Math.max(Math.round(fit), photoFloor(boxWidth)));
  }
  const maxHeight = caps.length ? Math.min(...caps) : 0;
  const natural = boxWidth / ratio;
  if (maxHeight > 0 && natural > maxHeight) {
    return {width: Math.round(maxHeight * ratio), height: maxHeight};
  }
  return {width: Math.round(boxWidth), height: Math.round(natural)};
}

/**
 * 첫 화면 맞춤 높이(fit): viewport − (사진 위 끝 + 간격 + AI 고지 + 간격 + 질문 첫 문장) − 여유(PHOTO_FIT_SLACK).
 * 모두 사진 높이와 상관없는 값이라 사진을 줄여도 다시 바뀌지 않는다(측정 → 줄임 → 재측정 반복 없음).
 */
export function photoFit(viewport: number, photoTop: number, gap: number, notice: number, question: number): number | undefined {
  if (!(viewport > 0)) {
    return undefined;
  }
  return viewport - photoTop - gap - (notice > 0 ? notice + gap : 0) - question - PHOTO_FIT_SLACK;
}
