// 첫 화면 "앨범 펼침"(FS_D) 사진 묶음 크기 계산. 앞 사진 1장 + 뒤 2장 부채꼴(±31% 옆으로, -9°/+8°).
// 영역(onLayout 으로 잰 실제 남은 공간) 안에 묶음 전체(기울기·테이프 포함)가 들어가는 가장 큰 크기를 찾는다.
// 앞 틀 폭은 영역 폭의 44% 이하. 앞 사진 폭이 72 미만이 되면 숨긴다(잘리는 것보다 낫다).
export const PHOTO_RATIO = 1152 / 928; // 원본 사진(가로형) 비율
export const PAD = 8; // 틀 안쪽 여백(위·좌·우)
export const BAND = 30; // 틀 아래 흰 띠(캡션 없음)
export const FRONT_DEG = 2;
export const BACK_LEFT_DEG = 9;
export const BACK_RIGHT_DEG = 8;
export const BACK_DX = 0.31; // 뒤 사진이 옆으로 나가는 정도(틀 폭 비율)
export const BACK_DY = 0.05; // 뒤 사진이 아래로 내려앉는 정도(틀 높이 비율)
const TAPE_OVER = 12; // 테이프가 틀 위로 나오는 높이
const MARGIN = 8; // 묶음 위아래 여유 합
const MIN_PHOTO_W = 72;

const rad = (d: number) => (d * Math.PI) / 180;
const bbox = (w: number, h: number, deg: number) => ({
  w: w * Math.cos(rad(deg)) + h * Math.sin(rad(deg)),
  h: w * Math.sin(rad(deg)) + h * Math.cos(rad(deg)),
});

export type StackLayout = {
  photoW: number;
  photoH: number;
  frameW: number;
  frameH: number;
  dx: number;
  dy: number;
  totalW: number;
  totalH: number;
};

export function measureStack(photoW: number): StackLayout {
  const photoH = Math.floor(photoW / PHOTO_RATIO);
  const frameW = photoW + 2 * PAD;
  const frameH = PAD + photoH + BAND;
  const dx = Math.round(frameW * BACK_DX);
  const dy = Math.round(frameH * BACK_DY);
  const back = bbox(frameW, frameH, BACK_LEFT_DEG);
  const front = bbox(frameW, frameH, FRONT_DEG);
  const totalW = Math.ceil(2 * dx + back.w);
  // 회전한 뒤의 상자 크기로 잰다(리뷰 공식): 뒤 사진(9°) 상자 높이 + 아래로 내려앉음 5% + 테이프 12 + 여유 8
  const totalH = Math.ceil(Math.max(front.h, back.h + dy) + TAPE_OVER + MARGIN);
  return {photoW, photoH, frameW, frameH, dx, dy, totalW, totalH};
}

export function stackLayout(areaW: number, areaH: number): StackLayout | null {
  if (!(areaW > 0) || !(areaH > 0)) {
    return null;
  }
  for (let w = Math.floor(areaW * 0.44) - 2 * PAD; w >= MIN_PHOTO_W; w--) {
    const l = measureStack(w);
    if (l.totalW <= areaW && l.totalH <= areaH) {
      return l;
    }
  }
  return null;
}
