// 오늘 코스 5단계 계약(앱 쪽 제안, 서버 레인 server/five-steps 병합 전). 플랫폼 무관 TS만.
// 근거: DECISIONS 2026-11-25 '3단계 → 5단계'(R-1·R-3), docs/team/copy/2026-11-25-five-steps-copy.md 4.2절(⑤ 키 5개).
// - 단계 이름 2개(recall·pass_on)를 record_session_step 이 받는다(서버 ㉠). 완료 판정은 '옛 3단계 모두 포함'(서버 ㉡, R-3).
// - ② 저장 값 = 보기 번호(1~3), ⑤ 저장 값 = 틀 키 하나. 둘 다 동의(답을 보여 주는 중)일 때만 저장, 넘긴 날은 저장하지 않는다.
// - ⑤는 서버 플래그(pass_on_enabled, 법률 L-11 승인 전 꺼짐)가 꺼져 있으면 저장하지 않는다.
// 이름(칸·RPC)은 서버 PR 이 정하면 이 파일 한 곳만 맞춘다. realApi 는 그때 연결한다(지금은 not_ready).

/** 5단계에서 새로 생기는 단계 이름 */
export const NEW_STEP_NAMES = ['recall', 'pass_on'] as const;
export type NewStepName = (typeof NEW_STEP_NAMES)[number];

/** ② 고른 보기 번호(콘텐츠 보기1~3 순서 그대로) */
export type RecallChoice = 1 | 2 | 3;
export const isRecallChoice = (v: unknown): v is RecallChoice => v === 1 || v === 2 || v === 3;

/**
 * ⑤ 틀 키 5개(문구 문서 4.2). 자리 1: recall_story(②를 고른 날) / photo_memory(넘긴 날),
 * 자리 2: choice_like(③을 고른 날) / photo_like(넘긴 날), 자리 3: ask_which(늘). 응원 키(cheers.ts)와 다른 목록이다.
 */
export const PASS_ON_KEYS = ['recall_story', 'photo_memory', 'choice_like', 'photo_like', 'ask_which'] as const;
export type PassOnKey = (typeof PASS_ON_KEYS)[number];
export const isPassOnKey = (v: unknown): v is PassOnKey => typeof v === 'string' && (PASS_ON_KEYS as readonly string[]).includes(v);

/**
 * get_today_content·start_today 에 더해질 칸(제안). 옛 서버는 칸이 없다 → parseFiveStepsContent 가 빈 값으로 읽는다.
 * - recall: 그날 ② 보기 3개(없으면 null — 그날 ②는 보기 없이 넘어가기만)
 * - recall_choice: 오늘 저장된 ② 번호(동의한 경우만)
 * - pass_on_key: 오늘 저장된 ⑤ 키(동의 + 플래그 켜짐인 경우만)
 * - pass_on_enabled: ⑤ 저장 플래그
 */
export type FiveStepsContent = {
  recall: {options: readonly [string, string, string]} | null;
  recall_choice: RecallChoice | null;
  pass_on_key: PassOnKey | null;
  pass_on_enabled: boolean;
};

export function parseFiveStepsContent(v: unknown): FiveStepsContent {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const r = o.recall && typeof o.recall === 'object' ? (o.recall as Record<string, unknown>).options : undefined;
  const options = Array.isArray(r) && r.length === 3 && r.every(x => typeof x === 'string' && x.length > 0) ? (r as [string, string, string]) : null;
  return {
    recall: options ? {options} : null,
    recall_choice: isRecallChoice(o.recall_choice) ? o.recall_choice : null,
    pass_on_key: isPassOnKey(o.pass_on_key) ? o.pass_on_key : null,
    pass_on_enabled: o.pass_on_enabled === true,
  };
}

/** 저장 RPC 가 아직 서버에 없을 때 realApi 가 던지는 이유(화면은 저장 없이 진행한다 — consent_required 와 같게) */
export const FIVE_STEPS_NOT_READY = 'five_steps_not_ready';
