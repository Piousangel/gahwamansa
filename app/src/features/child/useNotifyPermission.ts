import {useCallback, useEffect, useState} from 'react';
import {AppState, Platform} from 'react-native';
import {openNotifySettings, readNotifyPermission, requestNotifyPermission} from '../../push/notifyNative';
import {childPermissionResult} from '../../push/runtime';

export type NotifyState = 'granted' | 'denied' | 'unknown';

// 리뷰 M1(리드 결정 11-18): AU-04 전에는 켤 길이 없어 C3 줄·C7 알림 행을 숨겼다. AU-04(매니페스트 POST_NOTIFICATIONS·요청·토큰 등록)로 켬.
// 다시 숨겨야 하면 이 값 하나만 false.
export const notifyFlags = {promptReady: true};

// 알림 권한 실제 상태(AC-04 → AU-04 push/notifyNative).
// - Android 13(API 33) 이상: POST_NOTIFICATIONS 허용 여부 + 앱 단위 알림 끔. 휴대폰 설정에서 돌아오면(앱 활성) 다시 본다.
// - Android 12 이하: 런타임 권한은 없고, 앱 단위로 알림을 껐는지(areNotificationsEnabled, 네이티브 PushModule)로 본다.
export async function readNotifyState(): Promise<NotifyState> {
  if (!notifyFlags.promptReady || Platform.OS !== 'android') {
    return 'unknown';
  }
  const p = await readNotifyPermission();
  return p === 'granted' ? 'granted' : p === 'unknown' ? 'unknown' : 'denied';
}

// C3 "연결되면 알려 드릴게요 · 알림 켜기"·C7 알림 행이 쓰는 상태. denied 일 때만 켜기 안내를 보인다.
// 허용되면 서버 받기 동의(set_push_enabled true, 0036)·토큰 등록은 push/runtime 이 한다(자녀 권한 허용 = 받기 동의).
export function useNotifyPermission(): {state: NotifyState; denied: boolean; open: () => void} {
  const [state, setState] = useState<NotifyState>('unknown');

  const refresh = useCallback(() => {
    readNotifyState().then(setState);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  // 켜기: 한 번도 묻지 않았으면 시스템 창, 이미 거절(다시 묻지 않음)·앱 알림 끔·12 이하면 휴대폰 설정
  const open = useCallback(() => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      requestNotifyPermission().then(p => {
        childPermissionResult(p).catch(() => {});
        if (p === 'granted') {
          refresh(); // 앱 단위로 꺼져 있을 수도 있어 다시 확인
        } else if (p === 'blocked' || p === 'unknown') {
          openNotifySettings();
        }
      });
      return;
    }
    openNotifySettings();
  }, [refresh]);

  return {state, denied: state === 'denied', open};
}
