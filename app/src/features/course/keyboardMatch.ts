// 자판으로 쓰기(P6) 판정. 입력 글자는 화면 안에서만 쓰고 서버·이벤트로 보내지 않는다.
// - 양쪽을 NFC 정규화 + 모든 공백 제거 후 비교(자동 띄어쓰기·추천 낱말 뒤 공백 무시).
// - RN에는 한글 조합 시작·끝 이벤트가 없어 "조합 중" 판정은 하지 않는다. 대신 목표 음절과 같아진 칸만,
//   앞에서부터 채운다. 틀린 칸 정보는 만들지 않는다.
// - 마지막 음절은 자모(NFD)로 목표 음절을 앞부분에 품으면 칸을 유지한다(두벌식 "나 → 남 → 나무"에서 칸이
//   잠깐 비면 어르신에게 '틀렸다'로 읽힘, 리뷰 4). 자동 완료는 isMatch 로만 하므로 오판 위험은 없다.
// - 추천 낱말이 조사를 붙여 넣는 경우("나무가")는 낱말 뒤 1~2음절 조사만 남으면 일치로 본다(리뷰 3, 리드 추천안).

/** 낱말 뒤에 붙어도 일치로 보는 조사(1~2음절). 콘텐츠 낱말은 명사라 조사만 다룬다. */
const PARTICLES = new Set([
  '이', '가', '은', '는', '을', '를', '에', '도', '와', '과', '의', '로', '만', '랑', '께', '요',
  '으로', '에서', '에게', '한테', '까지', '부터', '하고', '이랑', '처럼', '보다', '이나', '이요',
]);

export function normalizeWord(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, '');
}

export function syllables(s: string): string[] {
  return Array.from(normalizeWord(s));
}

const nfd = (s: string) => s.normalize('NFD');

export function filledCount(input: string, target: string): number {
  const a = syllables(input);
  const b = syllables(target);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) {
    n += 1;
  }
  // 조합 중인 마지막 음절이 목표 음절을 자모 접두로 품으면(남 ⊃ 나) 그 칸도 채운다
  if (n < b.length && n === a.length - 1 && nfd(a[n]).startsWith(nfd(b[n]))) {
    n += 1;
  }
  return n;
}

export function isMatch(input: string, target: string): boolean {
  const t = normalizeWord(target);
  const i = normalizeWord(input);
  if (t.length === 0 || !i.startsWith(t)) {
    return false;
  }
  const rest = i.slice(t.length);
  return rest === '' || PARTICLES.has(rest);
}
