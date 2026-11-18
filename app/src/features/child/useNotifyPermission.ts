import {useCallback, useEffect, useState} from 'react';
import {AppState, Linking, PermissionsAndroid, Platform} from 'react-native';

export type NotifyState = 'granted' | 'denied' | 'unknown';

// 리뷰 M1(리드 결정 11-18): AU-04(매니페스트 POST_NOTIFICATIONS 선언·권한 요청·토큰 등록)가 main 에 들어오기 전에는
// 꺼짐이어도 켤 길이 없다(선언 없는 권한은 늘 거절) → C3 줄·C7 알림 행을 숨긴다. AU-04 가 들어올 때 이 값 하나만 true 로.
export const notifyFlags = {promptReady: false};

// 알림 권한 실제 상태(AC-04, 의존성 없이 RN 코어만).
// - Android 13(API 33) 이상: POST_NOTIFICATIONS 허용 여부. 휴대폰 설정에서 돌아오면(앱 활성) 다시 본다.
// - Android 12 이하: 런타임 권한이 없어 허용으로 본다. 앱 단위로 알림을 끈 경우(areNotificationsEnabled)는 네이티브가 필요 → ASSUMED(AU-04 푸시 클라이언트가 채움).
// TODO(AU-04): 매니페스트 POST_NOTIFICATIONS 선언·N1 안내 시트·토큰 등록은 푸시 클라이언트 몫. 선언 전에는 Android 13 이상에서 '꺼짐'으로 보인다(실제로 알림이 오지 않으므로 맞는 표시).
export async function readNotifyState(): Promise<NotifyState> {
  if (!notifyFlags.promptReady || Platform.OS !== 'android') {
    return 'unknown';
  }
  if (Number(Platform.Version) < 33) {
    return 'granted';
  }
  try {
    return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ? 'granted' : 'denied';
  } catch {
    return 'unknown';
  }
}

// C3 "연결되면 알려 드릴게요 · 알림 켜기"·C7 알림 행이 쓰는 상태. denied 일 때만 켜기 안내를 보인다.
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

  // 켜기: 한 번도 묻지 않았으면 시스템 창, 이미 거절(다시 묻지 않음)이면 휴대폰 설정
  const open = useCallback(() => {
    const toSettings = () => Linking.openSettings().catch(() => {});
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
        .then(r => {
          if (r === PermissionsAndroid.RESULTS.GRANTED) {
            setState('granted');
          } else if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            toSettings();
          }
        })
        .catch(toSettings);
      return;
    }
    toSettings();
  }, []);

  return {state, denied: state === 'denied', open};
}
