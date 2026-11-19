// 푸시 계약(서버 0033·0038 push_channel, Edge Function supabase/functions/_shared/push.mts). 플랫폼 무관 TS만.
// Android 알림 채널 id: 서버가 FCM 메시지에 넣는 channel_id 와 같아야 앱이 만든 채널로 알림이 온다(다르면 기본 채널로 떨어짐).
// 채널 3개(DECISIONS 11-18): daily·cheer·family. 종류 → 채널은 서버 push_channel(kind) 과 같다. eventsContract.test 가 서버와 비교한다.
import {PUSH_KINDS, type PushKind} from './events';

export const ANDROID_PUSH_CHANNELS = ['daily', 'cheer', 'family'] as const;
export type AndroidPushChannel = (typeof ANDROID_PUSH_CHANNELS)[number];

/** 서버가 channel 을 주지 않을 때의 기본(_shared/push.mts ANDROID_CHANNEL_ID) */
export const ANDROID_PUSH_CHANNEL_ID: AndroidPushChannel = 'daily';

/** 서버 push_channel(p_kind) 과 같은 대응 */
export function pushChannelFor(kind: PushKind): AndroidPushChannel {
  return kind === 'daily' ? 'daily' : kind === 'cheer_arrived' ? 'cheer' : 'family';
}

export {PUSH_KINDS, type PushKind};

// ── 앱이 부르는 RPC(서버 0032 register_push_token·unregister_push_token, 0033·0036·0037 set_push_enabled·my_push_settings) ──
// 근거: docs/team/dev-server-notes.md 2절. 토큰 형식은 서버 검사와 같다(0032: 20~4096자, [A-Za-z0-9_:-]).
// 토큰 플랫폼(서버 0032 register_push_token: 'android'|'ios' 만, 그 밖은 invalid_platform). RN Platform.OS 를 이 값으로 바꾼다(iOS 준비 N3)
export const PUSH_PLATFORMS = ['android', 'ios'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];
/** Platform.OS → 서버 값. 모르는 OS(web 등)는 null — 등록하지 않는다 */
export function pushPlatformOf(os: string): PushPlatform | null {
  return (PUSH_PLATFORMS as readonly string[]).includes(os) ? (os as PushPlatform) : null;
}

export const PUSH_TOKEN_RE = /^[A-Za-z0-9_:-]{20,4096}$/;
export const isPushTokenShape = (t: unknown): t is string => typeof t === 'string' && PUSH_TOKEN_RE.test(t);

export type RegisterPushTokenResult = {ok: true} | {ok: false; reason: 'invalid_token' | 'invalid_platform' | 'no_profile'};
export type SetPushEnabledResult = {ok: true; enabled: boolean} | {ok: false; reason: 'no_profile' | 'invalid'};
/** enabled = 실제로 받는 상태(켬 + 받기 시각, 0036). 연결 전 기기(프로필 없음)는 null */
export type MyPushSettings = {enabled: boolean | null};

const asObj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);

export function parseRegisterPushToken(v: unknown): RegisterPushTokenResult | null {
  const o = asObj(v);
  if (o?.ok === true) {
    return {ok: true};
  }
  return o?.ok === false && ['invalid_token', 'invalid_platform', 'no_profile'].includes(o.reason as string)
    ? {ok: false, reason: o.reason as 'invalid_token' | 'invalid_platform' | 'no_profile'}
    : null;
}

export function parseSetPushEnabled(v: unknown): SetPushEnabledResult | null {
  const o = asObj(v);
  if (o?.ok === true && typeof o.enabled === 'boolean') {
    return {ok: true, enabled: o.enabled};
  }
  return o?.ok === false && ['no_profile', 'invalid'].includes(o.reason as string)
    ? {ok: false, reason: o.reason as 'no_profile' | 'invalid'}
    : null;
}

export function parseMyPushSettings(v: unknown): MyPushSettings | null {
  const o = asObj(v);
  return o && (o.enabled === null || typeof o.enabled === 'boolean') ? {enabled: o.enabled as boolean | null} : null;
}

/** FCM data → 알림 종류. 서버 메시지 data 는 {kind} 하나(개인 id·번호 없음, 0033·0038). 모르는 값은 null */
export function parsePushKind(data: unknown): PushKind | null {
  const k = asObj(data)?.kind;
  return typeof k === 'string' && (PUSH_KINDS as readonly string[]).includes(k) ? (k as PushKind) : null;
}
