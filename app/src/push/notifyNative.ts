// 알림 권한·채널(AU-04). RN 코어 PermissionsAndroid + 작은 네이티브 PushModule(android/.../push/PushModule.kt). 새 의존성 없음.
import {Linking, NativeModules, PermissionsAndroid, Platform} from 'react-native';
import type {AndroidPushChannel} from '../api/contract/push';

/** granted 허용 · denied 아직/한 번 거절(시스템 창을 다시 띄울 수 있음) · blocked 다시 묻지 않음·앱 알림 꺼짐(휴대폰 설정으로) · unknown 판단 불가 */
export type NotifyPermission = 'granted' | 'denied' | 'blocked' | 'unknown';

export type ChannelSpec = {
  id: AndroidPushChannel;
  name: string;
  description: string;
  importance: 'default' | 'high';
  /** 잠금 화면 공개: public 내용 보임, private 휴대폰 '민감한 내용 숨기기'를 따름 */
  visibility: 'public' | 'private';
};

type PushNative = {
  createChannels(specs: ChannelSpec[]): Promise<number>;
  areNotificationsEnabled(): Promise<boolean>;
  channelEnabled(id: string): Promise<boolean | null>;
  openSettings(channelId: string | null): Promise<boolean>;
};
const native = (): PushNative | null => (NativeModules.PushModule as PushNative | undefined) ?? null;

const android = () => Platform.OS === 'android';
const api33 = () => android() && Number(Platform.Version) >= 33;

async function appEnabled(): Promise<boolean | null> {
  try {
    return (await native()?.areNotificationsEnabled()) ?? null;
  } catch {
    return null;
  }
}

/** 지금 권한 상태(시스템 창을 띄우지 않음). 13 이상에서 묻기 전·한 번 거절은 둘 다 denied(구분 불가) */
export async function readNotifyPermission(): Promise<NotifyPermission> {
  if (!android()) {
    return 'unknown';
  }
  if (api33()) {
    try {
      const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (!ok) {
        return 'denied';
      }
    } catch {
      return 'unknown';
    }
  }
  // 12 이하(런타임 권한 없음)와 13+ 허용 뒤: 앱 단위로 알림을 껐는지까지 본다. 모듈이 없으면(테스트) 허용으로 본다
  const on = await appEnabled();
  return on === false ? 'blocked' : 'granted';
}

/** 시스템 창(13 이상, 묻지 않음 상태가 아닐 때). 12 이하는 창이 없어 현재 상태만 돌려준다 */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!api33()) {
    return readNotifyPermission();
  }
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (r === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }
    return r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
  } catch {
    return 'unknown';
  }
}

/** 휴대폰 알림 설정 열기. 채널을 주면 그 채널 화면(P13 '그 채널만 꺼짐'). 모듈이 없으면 앱 설정 */
export async function openNotifySettings(channel?: AndroidPushChannel): Promise<void> {
  try {
    if (await native()?.openSettings(channel ?? null)) {
      return;
    }
  } catch {
    // 아래로
  }
  await Linking.openSettings().catch(() => {});
}

/** 채널 하나가 휴대폰에서 켜져 있는지. 채널이 없거나 모르면 null */
export async function channelEnabled(channel: AndroidPushChannel): Promise<boolean | null> {
  try {
    return (await native()?.channelEnabled(channel)) ?? null;
  } catch {
    return null;
  }
}

let made = false;
/** 채널 만들기(실행당 한 번, 실패해도 다음 실행에 다시). 이름·설명이 바뀌면 다시 불러 갱신할 수 있다 */
export async function ensureChannels(specs: ChannelSpec[]): Promise<void> {
  if (made || !android()) {
    return;
  }
  try {
    await native()?.createChannels(specs);
    made = true;
  } catch {
    // 다음 실행에 다시
  }
}
/** 테스트용 */
export function resetChannelsForTest() {
  made = false;
}
