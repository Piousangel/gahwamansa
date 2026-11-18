// 코스 홈의 날짜 줄·이번 주 도장 계산(KST 기준).
const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const kst = (now: Date) => new Date(now.getTime() + 9 * 3600e3);

export function kstDateLine(now: Date = new Date()): string {
  const d = kst(now);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${DAYS[d.getUTCDay()]}`;
}

// 지난 날(P15) 날짜 표기: 서버 session_date(KST 날짜 'YYYY-MM-DD') → "11월 19일 수요일"(copy 11-3 history.day)
export function historyDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`); // 이미 KST 날짜라 시차를 더하지 않는다
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${DAYS[d.getUTCDay()]}`;
}

// 월=0 … 일=6
export function kstWeekdayIndex(now: Date = new Date()): number {
  return (kst(now).getUTCDay() + 6) % 7;
}

// 이번 주 월요일(KST) 날짜 문자열. 미연결 기기 도장 줄(기기 로컬 목록)을 그릴 때 쓴다.
export function kstWeekStart(now: Date = new Date()): string {
  const d = kst(now);
  return new Date(d.getTime() - kstWeekdayIndex(now) * 86400e3).toISOString().slice(0, 10);
}

// 이번 주 7칸(월~일) 중 도장이 붙는 날: 서버가 준 완료 날짜(my_week_stamps)를 그대로 칠한다(띄엄띄엄 한 날 포함).
export function stampsFromDates(weekStart: string, doneDates: string[]): boolean[] {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const idx = new Set(doneDates.map(d => Math.round((Date.parse(`${d}T00:00:00Z`) - start) / 86400e3)));
  return Array.from({length: 7}, (_, i) => idx.has(i));
}
