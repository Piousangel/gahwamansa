// 코스 홈의 날짜 줄·이번 주 도장 계산(KST 기준).
const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const kst = (now: Date) => new Date(now.getTime() + 9 * 3600e3);

export function kstDateLine(now: Date = new Date()): string {
  const d = kst(now);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${DAYS[d.getUTCDay()]}`;
}

// 월=0 … 일=6
export function kstWeekdayIndex(now: Date = new Date()): number {
  return (kst(now).getUTCDay() + 6) % 7;
}

// 이번 주 7칸(월~일) 중 도장이 붙는 날: 서버가 준 완료 날짜(my_week_stamps)를 그대로 칠한다(띄엄띄엄 한 날 포함).
export function stampsFromDates(weekStart: string, doneDates: string[]): boolean[] {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const idx = new Set(doneDates.map(d => Math.round((Date.parse(`${d}T00:00:00Z`) - start) / 86400e3)));
  return Array.from({length: 7}, (_, i) => idx.has(i));
}
