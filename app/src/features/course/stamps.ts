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

// 이번 주 7칸 중 도장이 붙는 날. 서버가 주는 값은 연속일(streak)뿐이라, 오늘 끝냈으면 오늘까지,
// 아니면 어제까지 streak 일을 거슬러 칠한다(이번 주 밖은 자름). 연속이 아니던 이번 주의 앞선 날은 표시하지 못한다(서버에 주간 기록 RPC 필요).
export function weekStamps(todayIdx: number, streak: number, doneToday: boolean): boolean[] {
  const end = doneToday ? todayIdx : todayIdx - 1;
  const start = end - streak + 1;
  return Array.from({length: 7}, (_, i) => streak > 0 && i >= Math.max(0, start) && i <= end);
}
