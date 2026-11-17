// 이벤트 계약(서버 0022 log_event). 플랫폼 무관 TS만. 이름·속성 키·값 형식은 서버 화이트리스트(event_prop_ok)와 같아야 한다.
// 근거: migrations/20261116000022_events.sql, dev-server-notes 3절. 앱은 쓰기만, 글자 내용(입력 낱말 등)은 절대 싣지 않는다.

export const EVENT_NAMES = [
  'app_first_open', 'child_signup_completed', 'invite_code_issued',
  'parent_code_redeemed', 'parent_code_failed',
  'consent_shown', 'parent_consent_accepted', 'parent_consent_declined',
  'course_step_completed', 'course_completed', 'child_report_viewed',
  'invite_share_tapped', 'consent_revoked', 'account_deleted', 'cheer_sent', 'push_permission_result',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** 속성(최대 8개). 숫자는 0 이상 정수, 문자열은 키별 허용 값만(서버가 다시 검사). */
export type EventProps = Partial<{
  role_guess: 'parent' | 'child';
  login_method: 'kakao' | 'google' | 'email';
  purpose: 'parent_code' | 'reconnect' | 'sibling';
  step: 'photo' | 'question' | 'hangul';
  reason: 'expired' | 'used' | 'locked' | 'invalid' | 'rate_limited' | 'busy' | 'already_linked' | 'not_parent_device';
  channel: 'kakao' | 'sms' | 'copy' | 'share_sheet' | 'other';
  result: 'granted' | 'denied';
  message_key: 'love_you' | 'warm_day' | 'thanks_always' | 'peaceful_day';
  consent_version: string; // v2 형식
  app_version: string; // 1.0.0 또는 1.0.0-12
  install_source: string;
  ttl_hours: number;
  attempt_no: number;
  day_index: number;
  duration_sec: number;
  days_since_connect: number;
  tts_used: boolean;
  is_first: boolean;
}>;

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
