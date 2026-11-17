// 해님 문구 규칙(DECISIONS 11-17 Gemini 회의 권고: 칭찬·하트 금지, 말은 첫 만남·완료·오류에만).
// React·RN 없는 순수 함수라 토스 미니앱·백오피스(문구 편집 검사)도 그대로 쓴다.

const HEART = /[♥❤💕💖💗💓💞💘]|하트/;
// 띄어쓰기 변형 포함: "잘 하셨어요", "잘  했어요"
const PRAISE = /잘\s*(하셨|했|하시네|하세요)|훌륭|최고|대단|칭찬|똑똑|멋(져|지|있)|장하|장해/;

/** 칭찬·하트가 있으면 그 종류, 없으면 null. 문구 전체 검사(copy.ko.json)에 쓴다. */
export function praiseOrHeart(text: string): 'praise' | 'heart' | null {
  if (HEART.test(text)) return 'heart';
  if (PRAISE.test(text)) return 'praise';
  return null;
}

export type HanimIssue = 'heart' | 'praise' | 'tooLong';

/** 해님 말풍선 문구 검사. 20자 안팎·두 줄까지 → 40자 넘으면 너무 긺. */
export function hanimTextIssues(text: string): HanimIssue[] {
  const out: HanimIssue[] = [];
  if (HEART.test(text)) out.push('heart');
  if (PRAISE.test(text)) out.push('praise');
  if ([...text].length > 40) out.push('tooLong');
  return out;
}
