// 어르신 번호 화면: 번호 6칸 + 키 4줄이 남은 높이에 스크롤 없이 들어가도록 키 높이를 정한다.
// 번호 칸은 누르는 곳이 아니라 보여 주는 칸이라 52 고정, 키는 누르는 곳이라 64~68.
// 필요한 높이 = 칸 52 + 칸 아래 12 + 키 4줄 x (키 + 줄 간격 6) = 4 x 키 + 88.
export const KEY_MAX = 68;
export const KEY_MIN = 64; // 어르신 터치 최소
export const CELL_H = 52;
export const KEYPAD_FIXED = CELL_H + 12 + 4 * 6;

// 들어가면 키 높이(64~68), 64로도 안 들어가면 null(보조 문구·제목 크기를 줄여 공간을 더 만든다).
export function keypadKeyHeight(availH: number): number | null {
  const k = Math.floor((availH - KEYPAD_FIXED) / 4);
  if (k < KEY_MIN) {
    return null;
  }
  return Math.min(KEY_MAX, k);
}
