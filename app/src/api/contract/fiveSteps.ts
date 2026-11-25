// 오늘 코스 5단계 계약(서버 0061 five_steps). 플랫폼 무관 TS만(React·RN·copy import 금지). 화면은 앱 레인 몫 — 이 파일은 모양·파서만.
// 근거: supabase/migrations/20261116000061_five_steps.sql, docs/team/dev-server-notes.md "오늘 코스 5단계(0061)", DECISIONS 11-25 R-1·R-3.
// 서버가 바뀌면 이 파일만 맞춘다. 단계·⑤ 키 목록은 __tests__/fiveStepsContract.test.ts 가 마이그레이션 글자와 대조한다.

/** 이벤트 step 값(서버 event_prop_ok): 다섯 단계 + 여기까지 표지. 값은 이름뿐(낱말·문장 금지) */
export const EVENT_STEP_VALUES = ['photo', 'recall', 'question', 'hangul', 'pass_on', 'stop_here'] as const;
/** 단계 순서(① 사진 보기 → ② 떠올려 보기 → ③ 둘 중 고르기 → ④ 낱말 쓰기 → ⑤ 이야기 건네기). = daily_sessions.completed_steps check */
export const COURSE_STEPS = ['photo', 'recall', 'question', 'hangul', 'pass_on'] as const;
export type CourseStep = (typeof COURSE_STEPS)[number];
/** 옛 앱 3단계(서버가 p_course_len 기본 3으로 판정) */
export const LEGACY_STEPS = ['photo', 'question', 'hangul'] as const;
/** 새 앱은 record_session_step 모든 호출에 이 값을 보낸다 — 그래야 ⑤ 전에 도장이 찍히지 않는다 */
export const FIVE_STEP_COURSE_LEN = 5;

/**
 * record_session_step 인자(0061). 옛 2인자 호출({p_step, p_duration})도 그대로 풀린다(기본값).
 * - p_skipped: 「오늘은 넘어갈게요」. 넘긴 단계도 '했어요'로 치고, 그 단계에 저장된 값(②·③·⑤)은 서버가 지운다. ①은 넘길 수 없다(invalid_step).
 * - p_step 'stop_here': 「오늘은 여기까지 할게요」(③을 마친 뒤만, 아니면 예외 stop_before_question). 남은 ④·⑤를 넘어감으로 채워 완료.
 * - 넘긴 단계를 나중에 p_skipped=false 로 다시 기록하면 skipped_steps 에서 빠진다(홈에서 다시 하기).
 * 반환은 지금과 같다: {completed, steps, streak}.
 */
export type RecordStepArgs = {
  p_step: CourseStep | 'stop_here';
  p_duration: number;
  p_skipped?: boolean;
  p_course_len?: 3 | 5;
};

/** ⑤ 틀 문장 키(서버 pass_on_key_ok). 문장은 copy(라이터 확정·법률 승인 키만 화면에). 응원 키(CHEER_KEYS)와 다른 목록 */
// 라이터 확정 5키(docs/team/copy/2026-11-25-five-steps-copy.md 4.2): 자리 1 recall_story(② 고른 날)/photo_memory(② 넘긴 날),
// 자리 2 choice_like(③ 고른 날)/photo_like(③ 넘긴 날), 자리 3 ask_which(늘). 서버 missing_value: recall_story인데 ② 없음, choice_like인데 ③ 답 없음.
export const PASS_ON_KEYS = ['recall_story', 'photo_memory', 'choice_like', 'photo_like', 'ask_which'] as const;
export type PassOnKey = (typeof PASS_ON_KEYS)[number];
export const isPassOnKey = (k: unknown): k is PassOnKey => typeof k === 'string' && (PASS_ON_KEYS as readonly string[]).includes(k);

// ---- 어르신: get_today_content·start_today 추가 키(0061) ----
export type RecallOption = {slot: number; label: string};
/**
 * get_today_content·start_today 가 0061 에서 더한 최상위 키(계약 시험이 마이그레이션과 대조).
 * five_steps_supported 가 없는 서버(0061 전)면 앱은 3단계로 돈다 — 새 인자(p_skipped·p_course_len)를 보내면 함수 없음 오류.
 */
export const TODAY_FIVE_STEP_KEYS = ['five_steps_supported', 'skipped_steps', 'recall', 'pass_on'] as const;

/**
 * 앱 계약 규칙(서버 리뷰 QA-1 M1·L6, 리드 결정):
 * - ② 보기가 없는 날(recall.options = [])·⑤ 스위치가 꺼진 날(pass_on.enabled = false)에도 그 단계를 p_skipped:true 로 기록한다.
 *   기록하지 않으면 5단계 세션은 도장이 찍히지 않는다(서버는 stop_here 때만 빠진 ②를 채운다).
 * - stop_here 가 예외 stop_before_question 이면(③ 전, 또는 자정을 넘겨 새 날 세션) 오늘 콘텐츠를 다시 불러 홈에서 이어 하게 한다.
 * - 넘긴 단계의 저장은 서버가 거부한다: save_recall·save_pass_on → reason 'skipped', save_answer → 예외 'skipped'.
 *   넘김 뒤 홈에서 다시 하면 record_session_step(p_skipped:false)을 먼저 보내고 저장한다.
 */
export type TodayFiveSteps = {
  five_steps_supported: boolean;
  skipped_steps: CourseStep[];
  recall: {options: RecallOption[]; picked_slot: number | null};
  /** enabled=false: 서버 스위치 꺼짐(법률 L-11 전). 저장은 disabled 로 거부되고 자녀에게도 안 보인다 → ⑤를 '건넸어요'로 보여 주면 안 된다 */
  pass_on: {enabled: boolean; picked_key: PassOnKey | null};
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStep = (v: unknown): v is CourseStep => typeof v === 'string' && (COURSE_STEPS as readonly string[]).includes(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const strOrNull = (v: unknown) => v === null || v === undefined || typeof v === 'string';

/**
 * get_today_content/start_today(또는 preview_content) 객체에서 5단계 값만 읽는다. 옛 서버(키 없음)면 빈 값(② 보기 없음·⑤ 꺼짐).
 * 모양이 틀리면 null(호출부가 contract_mismatch).
 */
export function parseTodayFiveSteps(v: unknown): TodayFiveSteps | null {
  if (!isObj(v)) {
    return null;
  }
  const supported = v.five_steps_supported === true;
  const skipped = v.skipped_steps ?? [];
  const recall = v.recall ?? {options: [], picked_slot: null};
  const passOn = v.pass_on ?? {enabled: false, picked_key: null};
  if (!Array.isArray(skipped) || !skipped.every(isStep) || !isObj(recall) || !isObj(passOn)) {
    return null;
  }
  const opts = recall.options ?? [];
  if (!Array.isArray(opts) || !opts.every(o => isObj(o) && typeof o.slot === 'number' && typeof o.label === 'string')) {
    return null;
  }
  const picked = recall.picked_slot ?? null;
  const key = passOn.picked_key ?? null;
  if (!(picked === null || typeof picked === 'number') || !(key === null || isPassOnKey(key)) || typeof passOn.enabled !== 'boolean') {
    return null;
  }
  return {
    five_steps_supported: supported,
    skipped_steps: skipped,
    recall: {options: opts.map(o => ({slot: o.slot as number, label: o.label as string})), picked_slot: picked},
    pass_on: {enabled: passOn.enabled, picked_key: key},
  };
}

// ---- 어르신: 저장 RPC ----
/** sb.rpc('save_recall', {p_day_index, p_slot}) — p_day_index 는 화면에 보여 준 콘텐츠 day_index. no_content = 콘텐츠 또는 그날 ② 보기 없음 */
export const SAVE_RECALL_REASONS = ['consent_required', 'no_content', 'stale_day', 'skipped', 'invalid_option'] as const;
export type SaveRecallResult = {ok: true} | {ok: false; reason: (typeof SAVE_RECALL_REASONS)[number]};
/** sb.rpc('save_pass_on', {p_day_index, p_key}). missing_value = 끼울 값(② 고른 것·③ 답)이 오늘 없음 */
export const SAVE_PASS_ON_REASONS = ['disabled', 'consent_required', 'invalid_key', 'no_content', 'stale_day', 'skipped', 'missing_value'] as const;
export type SavePassOnResult = {ok: true} | {ok: false; reason: (typeof SAVE_PASS_ON_REASONS)[number]};

function parseOkReason<R extends string>(v: unknown, reasons: readonly R[]): {ok: true} | {ok: false; reason: R} | null {
  if (!isObj(v)) {
    return null;
  }
  if (v.ok === true) {
    return {ok: true};
  }
  return v.ok === false && reasons.includes(v.reason as R) ? {ok: false, reason: v.reason as R} : null;
}
export const parseSaveRecallResult = (v: unknown): SaveRecallResult | null => parseOkReason(v, SAVE_RECALL_REASONS);
export const parseSavePassOnResult = (v: unknown): SavePassOnResult | null => parseOkReason(v, SAVE_PASS_ON_REASONS);

// ---- 자녀(child_answer_history)·어르신 미리보기(parent_preview_child_view.history): 어르신 항목 추가 배열 ----
/** ② 고른 낱말. 넘긴 날·동의 안 함은 행이 없다(무표시). 목록(C5)에 한 줄 */
export type ChildRecall = {session_date: string; label: string};
/**
 * ⑤ 건넨 말: 틀 키 + 끼울 값(그날 ②·③). 앨범 카드·날짜 상세에만(시안 6). 서버 스위치가 꺼져 있으면 항상 [].
 * recall_story → recall_label, choice_like → choice_label, ask_which → option_a·option_b(보조 줄), photo_memory·photo_like → 값 없음.
 */
export type ChildPassOn = {
  session_date: string;
  line_key: PassOnKey;
  recall_label: string | null;
  choice_label: string | null;
  option_a: string | null;
  option_b: string | null;
};
export type ChildFiveSteps = {parent_id: string; recalls: ChildRecall[]; pass_ons: ChildPassOn[]};

/**
 * child_answer_history 응답(또는 미리보기 history)의 parents[] 에서 ②·⑤만 읽는다. 옛 서버(키 없음)면 빈 배열.
 * 모르는 ⑤ 키(앱보다 새 서버)는 줄 단위로 버린다(앱이 문장을 모름). 모양이 틀리면 null.
 */
export function parseChildFiveSteps(v: unknown): ChildFiveSteps[] | null {
  if (!isObj(v) || !Array.isArray(v.parents)) {
    return null;
  }
  const out: ChildFiveSteps[] = [];
  for (const p of v.parents) {
    if (!isObj(p) || typeof p.parent_id !== 'string') {
      return null;
    }
    const recalls = p.recalls ?? [];
    const passOns = p.pass_ons ?? [];
    if (!Array.isArray(recalls) || !Array.isArray(passOns)) {
      return null;
    }
    if (!recalls.every(r => isObj(r) && isDate(r.session_date) && typeof r.label === 'string')) {
      return null;
    }
    if (
      !passOns.every(
        x =>
          isObj(x) &&
          isDate(x.session_date) &&
          typeof x.line_key === 'string' &&
          strOrNull(x.recall_label) &&
          strOrNull(x.choice_label) &&
          strOrNull(x.option_a) &&
          strOrNull(x.option_b),
      )
    ) {
      return null;
    }
    out.push({
      parent_id: p.parent_id,
      recalls: recalls.map(r => ({session_date: r.session_date as string, label: r.label as string})),
      pass_ons: passOns
        .filter(x => isPassOnKey(x.line_key))
        .map(x => ({
          session_date: x.session_date as string,
          line_key: x.line_key as PassOnKey,
          recall_label: (x.recall_label as string | null | undefined) ?? null,
          choice_label: (x.choice_label as string | null | undefined) ?? null,
          option_a: (x.option_a as string | null | undefined) ?? null,
          option_b: (x.option_b as string | null | undefined) ?? null,
        })),
    });
  }
  return out;
}
