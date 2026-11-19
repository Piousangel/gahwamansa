// 계정별 기기 기억값(리뷰 M4): 같은 기기에서 다른 계정으로 들어와도 앞 계정 기억이 섞이지 않게 키에 계정 가명값을 붙인다.
// 가명값은 Api.accountTag()(auth user id 의 sha256 앞 16자) — user id 원문은 저장하지 않는다. React 를 모른다(lib 규칙).
// 솔트 없는 해시라 기기 밖(서버·log_event·console)으로 보내지 않는다(재검토 R3).
import type {KeyValueStore} from './kvStore';

export const SEEN_PARENTS_KEY = 'seen_parent_ids_v1'; // N3 본 어르신 id 목록
export const PAID_INTEREST_KEY = 'paid_interest_v1'; // C6 관심 남김
export const PUSH_PROMPT_KEY = 'push_prompt_v1'; // 어르신 N1·토글 답('yes'·'yes_pending' 서버 미반영·'no'·'off' 앱에서 끔), AU-04
export const PUSH_SKIP_DAY_KEY = 'push_prompt_skip_day_v1'; // 어르신 N1 을 답 없이 닫은 날(KST YYYY-MM-DD). 같은 날 다시 묻지 않음(PR #72 리뷰 M1)
export const TERMS_PENDING_KEY = 'terms_pending_v1'; // 자녀 약관·방침 동의 기록이 실패해 다음 시작 때 한 번 다시 보낼 것('1'), PR1 리뷰 M1
// 계정 단위 1회 이벤트 표시(prefs ONCE_PREFIX + 이름, track.ts PER_ACCOUNT) — 계정을 지우면 가명값 흔적도 지운다(PR #67 리뷰 L1)
export const ONCE_FIRST_ANSWER_VIEWED_KEY = 'pref_evt_once_child_first_answer_viewed';
const ACCOUNT_KEYS = [SEEN_PARENTS_KEY, PAID_INTEREST_KEY, PUSH_PROMPT_KEY, PUSH_SKIP_DAY_KEY, TERMS_PENDING_KEY, ONCE_FIRST_ANSWER_VIEWED_KEY];

export const accountKey = (base: string, tag: string) => `${base}:${tag}`;

/** 로그아웃·계정 삭제 때 그 계정의 기억값을 지운다(실패해도 계속) */
export async function clearAccountKeys(store: KeyValueStore, tag: string | null): Promise<void> {
  if (!tag) {
    return;
  }
  await Promise.all(ACCOUNT_KEYS.map(k => store.removeItem(accountKey(k, tag)).catch(() => {})));
}
