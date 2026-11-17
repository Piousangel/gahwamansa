import {useCallback} from 'react';
import {Linking} from 'react-native';

// 알림 권한 상태(C3 "연결되면 알려 드릴게요 / 알림 켜기" 줄은 꺼짐일 때만).
// TODO(U15 푸시): 권한 조회·요청(N1 시트 → 시스템 창)이 생기면 실제 상태를 준다. 그 전에는 줄을 숨긴다(denied=false).
export function useNotifyPermission(): {denied: boolean; open: () => void} {
  const open = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);
  return {denied: false, open};
}
