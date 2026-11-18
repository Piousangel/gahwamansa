// 이벤트 계약(서버 0022 log_event + 0029 연결 퍼널 + 0034 빌드 1 추가). 플랫폼 무관 TS만. 이름·속성 키·값은 서버 화이트리스트
// (log_event 이름 목록 · event_prop_ok)와 글자까지 같아야 한다 — __tests__/eventsContract.test.ts 가 마이그레이션을 읽어 비교한다.
// 근거: migrations/20261116000022_events.sql·…029_events_funnel.sql·…034_events_build1.sql, dev-server-notes 3절.
// 앱은 쓰기만, 글자 내용(입력 낱말 등)·번호 값은 절대 싣지 않는다.

export const EVENT_NAMES = [
  'app_first_open', 'child_signup_completed', 'invite_code_issued',
  'parent_code_redeemed', 'parent_code_failed',
  'consent_shown', 'parent_consent_accepted', 'parent_consent_declined',
  'course_step_completed', 'course_completed', 'child_report_viewed',
  'invite_share_tapped', 'consent_revoked', 'account_deleted', 'cheer_sent', 'push_permission_result',
  // 연결 퍼널(0029, ease-and-joy E). redeem 성공은 parent_code_redeemed. 번호 값은 어떤 속성에도 넣지 않는다
  'link_opened', 'referrer_found', 'code_prefilled',
  // 빌드 1 추가(0034): C6 곧 유료, B1 사진 크게 보기, 전환 분모, 푸시 열기
  'paid_sheet_opened', 'paid_interest_tapped', 'photo_zoom_opened', 'child_first_answer_viewed', 'push_opened',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** 0033 push_copy.kind = 0034 push_kind. 알림 종류. */
export const PUSH_KINDS = ['daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** 문자열 속성: 키별 허용 값(서버 event_prop_ok 의 '^(a|b)$' 목록과 같음). */
export const EVENT_PROP_VALUES = {
  role_guess: ['parent', 'child'],
  login_method: ['kakao', 'google', 'email'],
  purpose: ['parent_code', 'reconnect', 'sibling'],
  reason: ['expired', 'used', 'locked', 'invalid', 'rate_limited', 'busy', 'already_linked', 'not_parent_device'],
  step: ['photo', 'question', 'hangul'],
  channel: ['kakao', 'sms', 'copy', 'share_sheet', 'other'],
  result: ['granted', 'denied', 'matched', 'kept', 'skipped'], // 0029: 권한(granted·denied) + 번호 채움 결과(matched·kept·skipped)
  message_key: ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'],
  source: ['app_link', 'referrer', 'manual'], // 0029 번호가 들어온 경로
  plan: ['monthly', 'yearly', 'gift'], // 0034 C6 가격 3안(관심 표시만)
  push_kind: PUSH_KINDS, // 0034
} as const;
/** 형식만 검사하는 문자열 속성(서버 정규식): v2 · 1.0.0(-12) · 영문 시작 소문자 */
export const EVENT_FORMAT_PROPS = ['consent_version', 'app_version', 'install_source'] as const;
/** 0 이상 정수(서버: 숫자 1~7자리) */
export const EVENT_NUMBER_PROPS = ['ttl_hours', 'attempt_no', 'day_index', 'duration_sec', 'days_since_connect'] as const;
export const EVENT_BOOLEAN_PROPS = ['tts_used', 'is_first'] as const;

type ValueProps = {-readonly [K in keyof typeof EVENT_PROP_VALUES]: (typeof EVENT_PROP_VALUES)[K][number]};
/** 속성(최대 8개). 서버가 다시 검사한다. */
export type EventProps = Partial<
  ValueProps &
    {[K in (typeof EVENT_FORMAT_PROPS)[number]]: string} &
    {[K in (typeof EVENT_NUMBER_PROPS)[number]]: number} &
    {[K in (typeof EVENT_BOOLEAN_PROPS)[number]]: boolean}
>;

/** log_event → jsonb. 실패도 예외가 아니라 {ok:false, reason}(계측 실패가 화면을 막지 않음). */
export type LogEventResult = {ok: true} | {ok: false; reason: 'invalid_name' | 'invalid_props' | 'rate_limited' | 'no_user'};

export function parseLogEventResult(v: unknown): LogEventResult | null {
  if (!v || typeof v !== 'object') {
    return null;
  }
  const o = v as Record<string, unknown>;
  if (o.ok === true) {
    return {ok: true};
  }
  if (o.ok === false && ['invalid_name', 'invalid_props', 'rate_limited', 'no_user'].includes(o.reason as string)) {
    return o as LogEventResult;
  }
  return null;
}

/** 조용히 넘겨도 되는 실패(한도·지워진 계정). 나머지(invalid_*)는 앱 버그라 개발 중에만 경고. */
export const isQuietEventFailure = (r: LogEventResult) => !r.ok && (r.reason === 'rate_limited' || r.reason === 'no_user');
