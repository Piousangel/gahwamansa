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

export type ShareLines = {intro: string; install: string; install_no_link: string; step: string; until: string; until_days: string};

// 번호 공유 메시지(라이터 확정 copy-v3 11-1 #5, ease-and-joy E): C2·C3 '번호 보내기'가 이 함수 하나로 조립한다.
// 사람 말 → 설치 안내 → 링크 → 이 번호로 연결 → 번호 단독 줄(3자리씩, 길게 눌러 복사·손으로 쓰기 쉽게) → 기한 + 안심 한 줄.
// 링크가 없으면(도메인 미정) 링크 줄을 빼고 설치 안내를 스토어 문장으로(11-6 #5). 기한을 모르면(막 만든 번호) "7일 동안".
export function buildShareMessage(t: ShareLines, safe: string, code: string, expiry: string | null, link: string | null): string {
  const shown = /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  const until = expiry ? t.until.split('{시각}').join(expiry) : t.until_days;
  return [link ? t.install : t.install_no_link, ...(link ? [link] : []), t.step, shown, `${until} ${safe}.`]
    .reduce((acc, line) => `${acc}\n${line}`, t.intro);
}

// 공유 링크(ease-and-joy A②): https://<도메인>/c#번호. 번호는 URL 조각이라 웹 서버 기록에 남지 않는다.
// 도메인이 정해지지 않았거나 https 가 아니면 null(메시지에서 링크 줄을 뺀다).
export function shareLink(base: string, code: string): string | null {
  if (!/^https:\/\/[^\s#?]+$/.test(base) || !/^\d{6}$/.test(code)) {
    return null;
  }
  return `${base.replace(/\/+$/, '')}#${code}`;
}
