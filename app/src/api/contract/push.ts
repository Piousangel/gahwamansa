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
