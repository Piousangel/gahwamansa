// 첫 화면 "앨범 펼침"(FS_D) 사진 묶음 크기 계산. 앞 사진 1장 + 뒤 2장 부채꼴.
// 영역(onLayout 으로 잰 실제 남은 공간) 안에 묶음 전체(회전 뒤 상자·테이프·여유 포함)가 들어가는 가장 큰 크기를 찾는다.
// 사진 묶음은 사용자가 고른 핵심이라 숨기기 전에 순서대로 줄인다(실기기 17-first-D):
//   기본(뒤 9°/8°, 펼침 31%, 테이프 12, 여유 8, 앞 사진 최소 72) → 회전 5° → 펼침 22% → 테이프 8 → 여유 4
//   → 앞 사진 최소 56 → 뒤 2장 빼고 앞 1장 → 그래도 안 되면 숨김.
// 앞 틀 폭은 영역 폭의 44% 이하.
export const PHOTO_RATIO = 1152 / 928; // 원본 사진(가로형) 비율
export const PAD = 8; // 틀 안쪽 여백(위·좌·우)
export const BAND = 30; // 틀 아래 흰 띠(캡션 없음)
export const FRONT_DEG = 2;
export const BACK_DY = 0.05; // 뒤 사진이 아래로 내려앉는 정도(틀 높이 비율)

type Variant = {rotL: number; rotR: number; spread: number; tape: number; margin: number; minW: number; single: boolean};
const BASE: Variant = {rotL: 9, rotR: 8, spread: 0.31, tape: 12, margin: 8, minW: 72, single: false};
export const VARIANTS: Variant[] = [
  BASE,
  {...BASE, rotL: 5, rotR: 5},
  {...BASE, rotL: 5, rotR: 5, spread: 0.22},
  {...BASE, rotL: 5, rotR: 5, spread: 0.22, tape: 8},
  {...BASE, rotL: 5, rotR: 5, spread: 0.22, tape: 8, margin: 4},
  {...BASE, rotL: 5, rotR: 5, spread: 0.22, tape: 8, margin: 4, minW: 56},
  {...BASE, rotL: 5, rotR: 5, spread: 0.22, tape: 8, margin: 4, minW: 56, single: true},
];

const rad = (d: number) => (d * Math.PI) / 180;
const bbox = (w: number, h: number, deg: number) => ({
  w: w * Math.cos(rad(deg)) + h * Math.sin(rad(deg)),
  h: w * Math.sin(rad(deg)) + h * Math.cos(rad(deg)),
});

export type StackLayout = Variant & {
  photoW: number;
  photoH: number;
  frameW: number;
  frameH: number;
  dx: number;
  dy: number;
  totalW: number;
  totalH: number;
};

export function measureStack(photoW: number, v: Variant = BASE): StackLayout {
  const photoH = Math.floor(photoW / PHOTO_RATIO);
  const frameW = photoW + 2 * PAD;
  const frameH = PAD + photoH + BAND;
  const dx = Math.round(frameW * v.spread);
  const dy = v.single ? 0 : Math.round(frameH * BACK_DY);
  const front = bbox(frameW, frameH, FRONT_DEG);
  const back = v.single ? front : bbox(frameW, frameH, Math.max(v.rotL, v.rotR));
  const totalW = Math.ceil(v.single ? front.w : 2 * dx + back.w);
  // 회전한 뒤의 상자 크기로 잰다: 뒤 사진 상자 높이 + 내려앉음 + 테이프 + 여유
  const totalH = Math.ceil(Math.max(front.h, back.h + dy) + v.tape + v.margin);
  return {...v, photoW, photoH, frameW, frameH, dx, dy, totalW, totalH};
}

export function stackLayout(areaW: number, areaH: number): StackLayout | null {
  if (!(areaW > 0) || !(areaH > 0)) {
    return null;
  }
  for (const v of VARIANTS) {
    for (let w = Math.floor(areaW * 0.44) - 2 * PAD; w >= v.minW; w--) {
      const l = measureStack(w, v);
      if (l.totalW <= areaW && l.totalH <= areaH) {
        return l;
      }
    }
  }
  return null;
}
