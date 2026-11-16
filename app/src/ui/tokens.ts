// designer.md §8 토큰 (값은 문서 그대로). 폰트 파일 번들은 에셋 단계에서 추가(미적용).
export const color = {
  paper: '#FBF1DC', card: '#FFFFFF', ink: '#2F2A24', inkSub: '#5C4E33',
  handwrite: '#6B4F25', action: '#C2410C', actionDark: '#9A3412',
  actionShadow: '#7C2D12', actionSoft: '#FFD9C2', done: '#166534',
  doneInk: '#14532D', doneSoft: '#CDEBDD', sky: '#CFE6F7', sun: '#FFC93C',
  sunRay: '#F59E0B', blush: '#FF9E7A', tape: '#F3E3B8', line: '#8C7A55',
  lineSoft: '#D9CBB0', disabled: '#E6D9BD', paperEdge: '#E3D3B0',
  placeholder: '#FFF59D',
} as const;
export const fontSize = {
  display: 36, title: 30, bubble: 24, body: 22, bodyMin: 20, hand: 32, childBody: 16,
} as const;
export const space = {s4: 4, s8: 8, s12: 12, s16: 16, s20: 20, s24: 24, s28: 28, s56: 56} as const;
export const radius = {chip: 12, card: 22, select: 24, button: 36} as const;
export const size = {
  buttonPrimary: 72, buttonSecondary: 64, touchMin: 64, childTouchMin: 48, stamp: 44, sunLarge: 88,
} as const;
export const MIN_BODY_FONT = 20;
export const MIN_TOUCH = 64;
