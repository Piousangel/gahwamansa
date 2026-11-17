// 응원 보내기 결과 정리(순수 함수). 어르신 한 분씩 보낸 결과를 모아 무엇을 알릴지 정한다(리뷰 M3).
export type CheerOutcome = 'ok' | 'daily_limit' | 'disconnected' | 'invalid_target' | 'invalid_key' | 'offline' | 'server';
export type CheerResultRow = {parentId: string; title: string; outcome: CheerOutcome};
export type CheerSummary = {
  kind: 'sent' | 'partial' | 'daily_limit' | 'offline' | 'server';
  titles: string[]; // 보낸 분들 호칭(sent·partial)
  retry: boolean; // 다시 보내면 될 수 있는 실패(인터넷·서버)가 있다
  reload: boolean; // 연결 상태가 바뀌었다(끊김·대상 아님) → 요약 다시 불러오기
};

const RETRYABLE: CheerOutcome[] = ['offline', 'server'];

export function summarizeCheer(rows: CheerResultRow[]): CheerSummary {
  const ok = rows.filter(r => r.outcome === 'ok');
  const failed = rows.filter(r => r.outcome !== 'ok');
  const retry = failed.some(r => RETRYABLE.includes(r.outcome));
  const reload = failed.some(r => r.outcome === 'disconnected' || r.outcome === 'invalid_target');
  const titles = ok.map(r => r.title);
  if (ok.length && !failed.length) {
    return {kind: 'sent', titles, retry: false, reload};
  }
  if (ok.length) {
    return {kind: 'partial', titles, retry, reload};
  }
  if (failed.length && failed.every(r => r.outcome === 'daily_limit')) {
    return {kind: 'daily_limit', titles: [], retry: false, reload};
  }
  return {kind: failed.some(r => r.outcome === 'offline') ? 'offline' : 'server', titles: [], retry: true, reload};
}
