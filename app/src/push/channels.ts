// 알림 채널 3개(DECISIONS 11-18): id 는 계약(api/contract/push.ts ANDROID_PUSH_CHANNELS = 서버 FCM channel_id), 이름·설명은 copy push.channel.*.
// 잠금 화면 공개(push-events 리뷰 L3 판단, dev-app-notes AU-04):
//   daily  = public  — 본문은 AI 사진 설명(개인 정보 없음), N1 시안이 잠금 화면 그림을 그대로 보여 준다
//   cheer  = private — 가족이 보낸 응원 문장. 휴대폰의 '민감한 내용 숨기기'를 켠 사람에게는 앱 이름만
//   family = private — 호칭("엄마 폰과 연결됐어요")이 가족 관계를 드러낸다. 위와 같음
// 중요도는 모두 default(소리는 휴대폰 설정을 따름, N1 "소리는 휴대폰 설정을 따라요"). 머리 위 팝업(high)은 쓰지 않는다.
import {ANDROID_PUSH_CHANNELS, type AndroidPushChannel} from '../api/contract/push';
import {copy} from '../copy/copy';
import type {ChannelSpec} from './notifyNative';

const VISIBILITY: Record<AndroidPushChannel, ChannelSpec['visibility']> = {daily: 'public', cheer: 'private', family: 'private'};

export function pushChannelSpecs(): ChannelSpec[] {
  const t = copy.push.channel;
  const text: Record<AndroidPushChannel, {name: string; description: string}> = {
    daily: {name: t.daily, description: t.daily_desc},
    cheer: {name: t.cheer, description: t.cheer_desc},
    family: {name: t.family, description: t.family_desc},
  };
  return ANDROID_PUSH_CHANNELS.map(id => ({id, ...text[id], importance: 'default', visibility: VISIBILITY[id]}));
}
