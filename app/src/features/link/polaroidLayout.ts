// 첫 화면 폴라로이드 사진 크기(실기기 3차):
// 사진 높이 = 남은 영역 높이 - (틀 위 여백 + 틀 안 캡션 줄 + 틀 밖 AI 표기 줄 + 위아래 여백 8 + 기울기 여유), 폭은 비율.
// 폭은 영역 폭의 50% 이하. 최소 폭 72로도 안 들어가면 숨긴다(잘리는 것보다 낫다). 숨김은 이 경우와 글자 배율 1.3 이상뿐.
export const PHOTO_RATIO = 1152 / 928; // 원본 사진(가로형) 비율
export const TILT_DEG = 2; // 폴라로이드 기울기(절댓값)
export const PAD = 8; // 틀 안쪽 여백(위·좌·우)
export const DEFAULT_PHOTO_W = 140; // 측정 전 기본
const MIN_PHOTO_W = 72;
const TILT = Math.sin((TILT_DEG * Math.PI) / 180); // 기울인 틀의 세로 여유(폭 x sin)

const line = (fontScale: number) => Math.ceil(20 * 1.5 * fontScale);
// 사진을 뺀 세로 크기: 틀 위 여백 + 캡션 줄(+위아래 4) + AI 표기 줄(+위 4) + 영역 위아래 여백 합 8
const chromeH = (fontScale: number) => PAD + (line(fontScale) + 8) + (line(fontScale) + 4) + 8;

export type PhotoSize = {w: number; h: number};

// 폴라로이드 전체(기울기 여유 포함) 세로 크기
export const polaroidTotalH = (p: PhotoSize, fontScale: number) => p.h + chromeH(fontScale) + Math.ceil((p.w + 2 * PAD) * TILT);

export function photoSize(areaW: number, areaH: number, fontScale: number): PhotoSize | null {
  if (!(areaW > 0) || !(areaH > 0)) {
    return {w: DEFAULT_PHOTO_W, h: Math.floor(DEFAULT_PHOTO_W / PHOTO_RATIO)}; // 측정 전
  }
  // h + chrome + (w + 2PAD) * TILT <= areaH, w = h * R
  const h = Math.floor((areaH - chromeH(fontScale) - 2 * PAD * TILT) / (1 + PHOTO_RATIO * TILT));
  let w = Math.floor(Math.min(areaW * 0.5, h * PHOTO_RATIO));
  if (w < MIN_PHOTO_W) {
    return null;
  }
  w = Math.max(MIN_PHOTO_W, w);
  return {w, h: Math.floor(w / PHOTO_RATIO)};
}

// 폴라로이드 캡션(사진 제목): 글자 크기는 사진 폭의 약 12%(12~18). 말줄임하지 않는다 — 한 줄에 다 안 들어가면 숨긴다.
export const captionFont = (photoW: number) => Math.max(12, Math.min(18, Math.round(photoW * 0.12)));
// 한 줄 폭 추정: 한글 1em, 그 밖(공백·숫자·영문) 0.5em
export const captionFits = (text: string, photoW: number) => {
  const size = captionFont(photoW);
  let em = 0;
  for (const ch of text) {
    em += /[가-힣]/.test(ch) ? 1 : 0.5;
  }
  return em * size <= photoW;
};
