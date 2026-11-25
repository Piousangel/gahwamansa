// 자녀 홈 '최근 한 달 고르신 것' 계약(서버 0068 child_summary parents[].month). 플랫폼 무관 TS만(React·RN·copy import 금지).
// 근거: docs/team/dev-server-notes.md §1 child_summary `month`.
// - 그 어르신이 답 공유에 동의했고 동의 버전이 v6 이상일 때만 키가 생긴다. 키가 없으면 앱은 지금 화면(날짜 카드) 그대로.
// - 값 = child_answer_history answers[] 와 같은 모양 + care(고르신 쪽 '챙겨 드릴 거리' 한 줄, 스위치 꺼짐이면 null).
// - 서버가 최근 30일·날짜 내림차순·최대 30개로 준다. 앱은 다시 정렬·묶음·세기를 하지 않는다(기획 v2.1 Q2·Q3 — 순위·숫자 없음).
import {pairShort} from '../../lib/childFormat';

export type MonthItem = {
  answeredDate: string; // session_date(YYYY-MM-DD, KST)
  promptShort: string; // 서버 prompt_short, 없으면 두 보기로 만든 '봄과 가을 중'
  optionA?: string;
  optionB?: string;
  choiceLabel: string; // 고르신 보기
  care: string | null; // 챙겨 드릴 거리. null 이면 줄을 숨긴다
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

function parseItem(v: unknown): MonthItem | null {
  if (!isObj(v) || typeof v.session_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.session_date)) {
    return null;
  }
  const choiceLabel = text(v.choice_label);
  const a = text(v.option_a);
  const b = text(v.option_b);
  const promptShort = text(v.prompt_short) ?? (a && b ? pairShort(a, b) : null);
  if (!choiceLabel || !promptShort) {
    return null;
  }
  return {answeredDate: v.session_date, promptShort, optionA: a ?? undefined, optionB: b ?? undefined, choiceLabel, care: text(v.care)};
}

/** 키가 없거나 배열이 아니면 undefined(지금 화면). 배열이면 읽을 수 있는 항목만(빈 배열 = 빈 상태). */
export function parseMonth(raw: unknown): MonthItem[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.map(parseItem).filter((m): m is MonthItem => m !== null);
}
