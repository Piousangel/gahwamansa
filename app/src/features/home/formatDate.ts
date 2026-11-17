// 'YYYY-MM-DD'(KST) -> "오늘" / "11월 16일" / "2025년 12월 1일". 오래된 날짜도 그대로 보여 준다(경과 일수는 세지 않는다).
export function formatAnswerDate(ymd: string, now: Date = new Date()): string {
  const todayKst = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  if (ymd === todayKst) {
    return '오늘';
  }
  const [y, m, d] = ymd.split('-').map(Number);
  return y === Number(todayKst.slice(0, 4)) ? `${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
}
