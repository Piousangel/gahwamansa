// 푸시 계약(서버 0033 push-daily). 플랫폼 무관 TS만.
// Android 알림 채널 id: 서버가 FCM 메시지에 넣는 channel_id(supabase/functions/push-daily/lib.mts ANDROID_CHANNEL_ID)와 같아야
// 앱이 만든 채널로 알림이 온다(다르면 기본 채널로 떨어짐). eventsContract.test 가 서버 파일과 비교한다.
export const ANDROID_PUSH_CHANNEL_ID = 'daily';

export {PUSH_KINDS, type PushKind} from './events';
