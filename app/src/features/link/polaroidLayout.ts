// 첫 화면 폴라로이드 크기 계산(명시값). 이미지 고유 크기·aspectRatio·% 폭에 기대지 않는다(실기기에서 세로로 늘어난 버그).
export const PHOTO_RATIO = 1152 / 928; // 원본 사진(가로형) 비율
export const TILT_DEG = 2; // 폴라로이드 기울기(절댓값)
const PAD = 8; // 틀 안쪽 여백(위·좌·우)
const MIN_PHOTO_W = 96; // 이보다 작으면 숨긴다(작은 화면·큰 글자). S25 첫 화면 남은 높이(약 183dp)에서도 보이게

export type PolaroidLayout = {photoW: number; photoH: number; frameW: number; frameH: number; captionH: number; outsideH: number};

// areaW·areaH: 사진 영역에 실제로 남은 크기(onLayout). fontScale: 캡션(틀 안 제목, 틀 밖 AI 표기) 줄 높이 계산용.
// caps: 사진 자체의 최대 폭·높이(첫 화면에서 사진은 보조 요소: 화면 폭 50%, 높이 22%).
export function polaroidLayout(
  areaW: number,
  areaH: number,
  fontScale: number,
  caps?: {maxPhotoW: number; maxPhotoH: number},
): PolaroidLayout | null {
  let availW = areaW;
  let availH = areaH;
  // 틀 안 캡션은 사진 제목 한 줄. "AI가 만든 그림"은 틀 밖 아래 한 줄(그 높이와 그림자 여백을 영역에서 먼저 뺀다)
  const line = Math.ceil(20 * 1.5 * fontScale);
  const captionH = line + 8;
  const outsideH = line + 4; // 틀 밖 AI 표기 줄
  const SHADOW = 8; // 그림자가 잘리지 않게 사방 여백
  availW -= 2 * SHADOW;
  availH -= 2 * SHADOW + outsideH;
  const rad = (TILT_DEG * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // 회전한 틀의 바깥 상자가 영역 안에 들어가는 가장 큰 사진 폭을 찾는다(사진 폭 w 에 대해 틀은 선형).
  // 틀: frameW = w + 2PAD, frameH = w/R + PAD + captionH
  const R = PHOTO_RATIO;
  const byW = (availW - 2 * PAD * cos - (PAD + captionH) * sin) / (cos + sin / R);
  const byH = (availH - 2 * PAD * sin - (PAD + captionH) * cos) / (sin + cos / R);
  const capW = caps ? Math.min(caps.maxPhotoW, caps.maxPhotoH * R) : Infinity;
  const photoW = Math.floor(Math.min(byW, byH, availW * 0.86, capW));
  if (!Number.isFinite(photoW) || photoW < MIN_PHOTO_W) {
    return null;
  }
  const photoH = Math.floor(photoW / R);
  return {photoW, photoH, frameW: photoW + 2 * PAD, frameH: photoH + PAD + captionH, captionH, outsideH};
}
