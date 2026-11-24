/**
 * P4 사진 틀 크기(오너 S25 피드백 11-24: 고정 높이 80~124 + cover 라 사진이 가로 띠처럼 잘렸다).
 * 사진은 원본 비율 그대로 보여 준다 — 잘라 내지 않는다.
 * - 틀 폭 = 본문 폭, 높이 = 폭 ÷ 비율.
 * - 높이가 상한(maxHeight)을 넘는 긴 사진은 높이를 상한으로 두고 폭을 같은 비율로 줄인다(가운데 정렬, 잘림 없음).
 * - 비율을 아직 모르면(불러오기 전·준비 중·실패) 기본 4:3 틀.
 * 글자 크기와 상관없다 — 200%에서도 사진은 줄이지 않고 본문이 스크롤된다.
 */
export const PHOTO_DEFAULT_ASPECT = 4 / 3;
/** 창 높이 대비 사진 높이 상한 */
export const PHOTO_MAX_HEIGHT_RATIO = 0.6;

export type PhotoFrame = {width: number; height: number};

export function photoAspect(w?: number, h?: number): number | null {
  return w && h && w > 0 && h > 0 && Number.isFinite(w / h) ? w / h : null;
}

export function photoFrame(boxWidth: number, aspect: number | null, windowHeight: number): PhotoFrame {
  if (!(boxWidth > 0)) {
    return {width: 0, height: 0};
  }
  const ratio = aspect && aspect > 0 && Number.isFinite(aspect) ? aspect : PHOTO_DEFAULT_ASPECT;
  const maxHeight = Math.round(windowHeight * PHOTO_MAX_HEIGHT_RATIO);
  const natural = boxWidth / ratio;
  if (maxHeight > 0 && natural > maxHeight) {
    return {width: Math.round(maxHeight * ratio), height: maxHeight};
  }
  return {width: Math.round(boxWidth), height: Math.round(natural)};
}
