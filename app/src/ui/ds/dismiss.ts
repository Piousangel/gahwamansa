/**
 * 닫기 말 네 갈래(전문가 리뷰 A5 8/8, W-09 + 11-20 리드 결정 'ack'). ds Dialog·Sheet 는 닫는 버튼 글자를 문자열로 받지 않고 이 값으로만 받는다.
 * - 'close': 상태를 바꾸지 않고 닫는다 → '닫기'
 * - 'later': 나중에 다시 묻는다 → '다음에'
 * - 'ack': **받은 소식을 확인했다**는 뜻 → '알겠어요'(라이터 확정 어르신 문구). P8 응원 도착처럼 알리기만 하는 상자에서만 쓴다.
 *   거절·취소가 필요한 곳(되돌릴 수 없는 행동의 닫는 쪽, 질문에 '아니요' 로 답하는 곳)에는 쓰지 않는다 — 그곳은 {decline}.
 *   쓰는 곳은 허용 목록(ACK_ALLOWED)으로 묶고 dsDialog 소스 스캔이 그 밖에서 쓰면 실패시킨다
 * - {decline}: 앞 질문의 부정 답 → '안 ○○할게요/래요'(질문과 짝일 때만, 문구는 화면 키에서). 형식은 copyBan 이 지킨다
 * 화면을 옮기는 버튼은 닫기가 아니라 목적지 이름('오늘 코스로')이라 여기 없다.
 */
export type Dismiss = 'close' | 'later' | 'ack' | {decline: string};

/** 'ack' 를 써도 되는 파일(받은 소식 확인 상자만). 늘리려면 리드 결정 + DECISIONS */
export const ACK_ALLOWED = ['features/course/CheerDialog.tsx'] as const;

/** '안 …요' — 부정 답 형식(A5, 7번 패널: 앞 질문과 짝) */
export const DECLINE_FORM = /^안 \S.*요$/;

/** 컴포넌트 계약의 고정 말(ui 는 copy 를 모른다 — ARCHITECTURE 2절). copy.ko.json dismiss 와 같은지는 copyBan 이 지킨다 */
export const DISMISS_TEXT = {close: '닫기', later: '다음에', ack: '알겠어요'} as const;

export function dismissLabel(d: Dismiss): string {
  if (d === 'close' || d === 'later' || d === 'ack') {
    return DISMISS_TEXT[d];
  }
  if (__DEV__ && !DECLINE_FORM.test(d.decline)) {
    console.warn(`[DS] 거절 말은 '안 ○○할게요/래요' 형식이어야 해요: ${d.decline}`);
  }
  return d.decline;
}
