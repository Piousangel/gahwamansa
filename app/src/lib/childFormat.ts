// 자녀 화면 글자 만들기(순수 함수). 시간은 모두 KST 로 보여 준다.

const KST = 9 * 3600e3;

// 번호 만료 시각 'ISO' -> "11월 24일 오후 3시"(분이 있으면 "오후 3시 30분", 다른 해면 연도 포함). 시안 C3 "expires_at 기준".
export function formatExpiry(iso: string, now: Date = new Date()): string {
  const d = new Date(new Date(iso).getTime() + KST);
  const thisYear = new Date(now.getTime() + KST).getUTCFullYear();
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const date = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return `${d.getUTCFullYear() === thisYear ? '' : `${d.getUTCFullYear()}년 `}${date} ${ampm} ${h12}시${m ? ` ${m}분` : ''}`;
}

// 마지막 글자에 받침이 있는가(한글이 아니면 false)
function hasFinal(word: string): boolean {
  const c = word.trim().slice(-1).charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
}

// 질문 짧은 형(보드 C §5): "봄과 가을 중", "바다와 산 중". 와/과는 받침으로 정한다.
export function pairShort(a: string, b: string): string {
  return `${a}${hasFinal(a) ? '과' : '와'} ${b} 중`;
}

// "482915" -> "4 8 2, 9 1 5"(화면 읽기용, 기존 규칙)
export function codeA11y(code: string): string {
  return `${code.slice(0, 3).split('').join(' ')}, ${code.slice(3).split('').join(' ')}`;
}

export type ShareLines = {intro: string; step1: string; step2: string; step3: string; until: string; until_days: string; safe: string};

// 번호 공유 메시지(시안 C2_share, 기능 회의 B4): C2 '번호 보내기'·C3 '번호 보내기'가 이 함수 하나로 조립한다.
// 번호는 3자리씩 띄우고, 기한은 만료 시각을 알면 "{시각}까지", 모르면(막 만든 번호) "7일 동안".
// TODO(스토어 링크): 출시 주소가 정해지면 1단계 다음 줄에 넣는다.
export function buildShareMessage(t: ShareLines, code: string, expiry: string | null): string {
  const shown = /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  return [
    t.intro,
    t.step1,
    t.step2,
    t.step3.split('{번호}').join(shown),
    expiry ? t.until.split('{시각}').join(expiry) : t.until_days,
    t.safe,
  ].join('\n');
}
