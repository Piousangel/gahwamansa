// 어르신 지난 날 계약(서버 0028 parent_history). 플랫폼 무관 TS만(React·RN·copy import 금지).
// 근거: docs/team/dev-server-notes.md "parent_history(p_days int default 30)". 서버가 바뀌면 이 파일만 맞춘다.
// - 어르신 본인만, p_days 1~30(넘치면 30), 코스를 연 날만(빈 날 없음), 최신순.
// - choice_label: 그날 저장된 답이 있을 때만. 동의 거부·철회한 날은 null(앱은 '고른 답' 줄을 뺀다).
// - 어르신이 친 글자는 저장하지 않아 없다. 낱말은 photo.keyword.

export const HISTORY_MAX_DAYS = 30;

export type HistoryDay = {
  session_date: string; // YYYY-MM-DD(KST)
  day_index: number;
  completed: boolean;
  photo: {caption: string; image_url: string; keyword: string};
  question: {prompt: string | null; option_a: string; option_b: string};
  choice_label: string | null;
};
export type ParentHistoryResult = {days: HistoryDay[]};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string';

function parseDay(v: unknown): HistoryDay | null {
  if (!isObj(v) || !str(v.session_date) || !/^\d{4}-\d{2}-\d{2}$/.test(v.session_date as string)) {
    return null;
  }
  const p = v.photo;
  const q = v.question;
  if (!isObj(p) || !str(p.caption) || !str(p.image_url) || !str(p.keyword)) {
    return null;
  }
  if (!isObj(q) || !str(q.option_a) || !str(q.option_b) || !(q.prompt === null || str(q.prompt))) {
    return null;
  }
  if (!(v.choice_label === null || v.choice_label === undefined || str(v.choice_label))) {
    return null;
  }
  return {
    session_date: v.session_date as string,
    day_index: typeof v.day_index === 'number' ? v.day_index : 0,
    completed: v.completed === true,
    photo: {caption: p.caption as string, image_url: p.image_url as string, keyword: p.keyword as string},
    question: {prompt: (q.prompt as string | null) ?? null, option_a: q.option_a as string, option_b: q.option_b as string},
    choice_label: (v.choice_label as string | null | undefined) ?? null,
  };
}

/** 응답 검증. 모양이 다르면 null(호출부가 contract_mismatch). 하루라도 깨졌으면 전체를 거부한다. */
export function parseParentHistory(v: unknown): ParentHistoryResult | null {
  if (!isObj(v) || !Array.isArray(v.days)) {
    return null;
  }
  const days = v.days.map(parseDay);
  return days.every((d): d is HistoryDay => d !== null) ? {days} : null;
}

/** p_days 를 서버 규칙대로 1~30 으로 */
export const clampDays = (n: number) => Math.max(1, Math.min(HISTORY_MAX_DAYS, Math.floor(n)));
