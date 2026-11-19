/**
 * 닫기 말 세 갈래(전문가 리뷰 A5 8/8, W-09). ds Dialog·Sheet 는 닫는 버튼 글자를 문자열로 받지 않고 이 값으로만 받는다.
 * - 'close': 상태를 바꾸지 않고 닫는다 → '닫기'
 * - 'later': 나중에 다시 묻는다 → '다음에'
 * - {decline}: 앞 질문의 부정 답 → '안 ○○할게요/래요'(질문과 짝일 때만, 문구는 화면 키에서). 형식은 copyBan 이 지킨다
 * 화면을 옮기는 버튼은 닫기가 아니라 목적지 이름('오늘 코스로')이라 여기 없다.
 */
export type Dismiss = 'close' | 'later' | {decline: string};

/** '안 …요' — 부정 답 형식(A5, 7번 패널: 앞 질문과 짝) */
export const DECLINE_FORM = /^안 \S.*요$/;

/** 컴포넌트 계약의 고정 말(ui 는 copy 를 모른다 — ARCHITECTURE 2절). copy.ko.json dismiss 와 같은지는 copyBan 이 지킨다 */
export const DISMISS_TEXT = {close: '닫기', later: '다음에'} as const;

export function dismissLabel(d: Dismiss): string {
  if (d === 'close' || d === 'later') {
    return DISMISS_TEXT[d];
  }
  if (__DEV__ && !DECLINE_FORM.test(d.decline)) {
    console.warn(`[DS] 거절 말은 '안 ○○할게요/래요' 형식이어야 해요: ${d.decline}`);
  }
  return d.decline;
}
