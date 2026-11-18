// 약관·방침 동의 기록 계약(서버 0046·0048 record_terms_agreement / my_terms_status, 법률 Q2). 플랫폼 무관 TS만.
// 근거: docs/team/dev-server-notes.md §2 "record_terms_agreement". 서버가 바뀌면 이 파일만 맞춘다.
// - 버전 표기 규칙(법률 재확인): 약관·방침 문서 머리의 "버전 1" = 서버 'v1', "버전 1.1" = 'v1.1'. 한 종류 안에서는 한 형식만.
//   지금 게시본(docs/team/legal/publish-drafts terms.html·privacy.html)은 둘 다 "버전 1" → 'v1'. 문서 머리를 바꾸면 여기와 같은 번호로 게시.
// - 같은 버전 쌍 반복은 새 기록 없음(recorded=false) — 다시 불러도 된다. 게시되지 않은 버전은 unknown_version(환경마다 출시 전 게시).
// - my_terms_status 는 needs_reagree 만 쓴다(xhigh 리뷰 L9: 나머지 값은 '마지막으로 새로 기록된 쌍'이라 화면 표시용이 아님).

export const TERMS_VERSION = 'v1';
export const PRIVACY_VERSION = 'v1';

/** 서버 형식(v<정수>[.<정수>] 또는 YYYY-MM-DD)과 같은지 — 앱 상수가 틀리면 개발 중에 바로 보이게 */
export const TERMS_VERSION_RE = /^(v\d+(\.\d+)?|\d{4}-\d{2}-\d{2})$/;

export type RecordTermsResult = {ok: true; recorded: boolean} | {ok: false; reason: 'invalid_version' | 'unknown_version'};
export type MyTermsStatus = {needsReagree: boolean};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function parseRecordTerms(v: unknown): RecordTermsResult | null {
  if (!isObj(v)) {
    return null;
  }
  if (v.ok === true && typeof v.recorded === 'boolean') {
    return {ok: true, recorded: v.recorded};
  }
  if (v.ok === false && (v.reason === 'invalid_version' || v.reason === 'unknown_version')) {
    return {ok: false, reason: v.reason};
  }
  return null;
}

export function parseMyTermsStatus(v: unknown): MyTermsStatus | null {
  return isObj(v) && typeof v.needs_reagree === 'boolean' ? {needsReagree: v.needs_reagree} : null;
}
