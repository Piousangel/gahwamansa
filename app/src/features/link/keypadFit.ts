// 어르신 번호 화면: 번호 6칸 + 키 4줄이 남은 높이에 스크롤 없이 들어가도록 키 높이를 정한다.
// 필요한 높이 = 칸 1줄 + 키 4줄(모두 같은 높이) + 간격(칸 아래 16 + 줄 간격 8 x 4) = 5 x 키 + 48.
export const KEY_MAX = 68;
export const KEY_MIN = 64; // 어르신 터치 최소
export const KEYPAD_GAPS = 48;

// 들어가면 키 높이(64~68), 64로도 안 들어가면 null(보조 문구를 숨겨 공간을 더 만든다).
export function keypadKeyHeight(availH: number): number | null {
  const k = Math.floor((availH - KEYPAD_GAPS) / 5);
  if (k < KEY_MIN) {
    return null;
  }
  return Math.min(KEY_MAX, k);
}
