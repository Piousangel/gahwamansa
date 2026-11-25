import {useCallback, useEffect, useState} from 'react';
import {AppState, Platform} from 'react-native';
import {openNotifySettings, readNotifyPermission, requestNotifyPermission} from '../../push/notifyNative';
import {childNotifyOptIn, pushReceive} from '../../push/runtime';

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

// C3 "연결되면 알려 드릴게요 · 알림 켜기"·연결 직후 화면·C7 알림 행이 쓰는 상태.
// '알림 켜기'를 누르면 서버 받기 동의(set_push_enabled true, 0036)·허용이면 토큰 등록은 push/runtime 이 한다(누른 것 = 받기 동의, 리뷰 L2).
// consented(H1, 오너 11-25): 서버 받기 동의(my_push_settings). false = 아직 안 누름 → OS 권한이 이미 허용(12 이하 기본 허용 포함)이어도
//   [알림 켜기]를 보인다(#269 이후 동의 전에는 토큰이 없어 알림이 오지 않으므로). null(프로필 없음)·'offline'·읽는 중은 모름 → 권한 기준만.
export type NotifyConsent = boolean | null | 'offline' | undefined;
export function useNotifyPermission(): {state: NotifyState; denied: boolean; consented: NotifyConsent; open: () => void} {
  const [state, setState] = useState<NotifyState>('unknown');
  const [consented, setConsented] = useState<NotifyConsent>(undefined);

  const refresh = useCallback(() => {
    readNotifyState().then(setState);
    pushReceive()
      .then(setConsented)
      .catch(() => setConsented('offline'));
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

  // 누른 뒤: 동의가 서버에 남았으면 다시 읽고, 못 남겼으면(오프라인 등) 줄을 그대로 둔다(#284 QA-1 L2 — 다시 읽기가 'offline'이라 숨겨지지 않게).
  const afterOptIn = useCallback(
    (ok: boolean) => {
      if (ok) {
        refresh();
        return;
      }
      readNotifyState().then(setState);
      setConsented(false);
    },
    [refresh],
  );

  // 켜기: 이미 허용이면(12 이하 기본 허용·전에 허용) 창 없이 받기 동의만, 한 번도 묻지 않았으면 시스템 창, 이미 거절(다시 묻지 않음)·앱 알림 끔이면 휴대폰 설정.
  // 누른 것이 받기 동의(리뷰 L2) → 결과와 상관없이 서버 받기 동의, 허용이면 토큰 등록(push/runtime)
  const open = useCallback(() => {
    readNotifyPermission()
      .catch(() => 'unknown' as const)
      .then(now => {
        if (now === 'granted') {
          return childNotifyOptIn('granted').then(afterOptIn);
        }
        openByAsking();
      })
      .catch(() => {});
    function openByAsking() {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        requestNotifyPermission().then(p => {
          childNotifyOptIn(p)
            .catch(() => false)
            .then(afterOptIn);
          if (p === 'blocked' || p === 'unknown') {
            openNotifySettings();
          }
        });
        return;
      }
      childNotifyOptIn('blocked')
        .catch(() => false)
        .then(afterOptIn);
      openNotifySettings();
    }
  }, [afterOptIn]);

  return {state, denied: state === 'denied', consented, open};
}
