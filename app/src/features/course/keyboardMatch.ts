// 자판으로 쓰기(P6) 판정. 입력 글자는 화면 안에서만 쓰고 서버·이벤트로 보내지 않는다.
// - 양쪽을 NFC 정규화 + 모든 공백 제거 후 비교(자동 띄어쓰기·추천 낱말 뒤 공백 무시).
// - RN에는 한글 조합 시작·끝 이벤트가 없어 "조합 중" 판정은 하지 않는다. 대신 목표 음절과 같아진 칸만,
//   앞에서부터 채운다(조합 중인 마지막 음절은 목표와 같아질 때 자연히 채워진다). 틀린 칸 정보는 만들지 않는다.

export function normalizeWord(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, '');
}

export function syllables(s: string): string[] {
  return Array.from(normalizeWord(s));
}

export function filledCount(input: string, target: string): number {
  const a = syllables(input);
  const b = syllables(target);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) {
    n += 1;
  }
  return n;
}

export function isMatch(input: string, target: string): boolean {
  const t = normalizeWord(target);
  return t.length > 0 && normalizeWord(input) === t;
}
