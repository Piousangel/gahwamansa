// 개발자 메뉴 관문(모든 빌드에 들어가는 작은 부분). 메뉴 구현(DevMenuHost.tsx)은 production 번들에서 Metro 가 빈 대역으로 바꾼다
// (metroDevMenu.js). 이 파일은 관문 판정·진입(버전 줄 7번 탭)만 갖고, 서버·세션·저장소를 모른다.
// 이중 방어: ① 번들에서 구현 제외(production) ② 실행 중에도 production 이면 탭을 받지 않는다.
import {createContext, useCallback, useContext, useRef} from 'react';
import {getAppEnv, type AppEnvName} from '../lib/env';

export const VERSION_TAPS = 7;
const TAP_WINDOW_MS = 4000;

/** production 은 절대 불가. staging 빌드는 가능, local 은 개발 빌드(__DEV__)에서만 */
export function isDevMenuAllowed(appEnv: AppEnvName, isDev: boolean): boolean {
  if (appEnv === 'production') {
    return false;
  }
  return appEnv === 'staging' || (appEnv === 'local' && isDev);
}

export type DevMenuApi = {open: () => void};
// 기본값은 아무것도 안 함(메뉴 호스트가 없거나 production 대역이면 그대로)
export const DevMenuContext = createContext<DevMenuApi>({open: () => {}});

/** 버전 줄에 붙이는 탭 처리. 허용 안 되면 undefined(누를 수 있는 요소가 되지 않는다) */
export function useVersionTaps(allowed: boolean): (() => void) | undefined {
  const {open} = useContext(DevMenuContext);
  const taps = useRef<number[]>([]);
  const onPress = useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < TAP_WINDOW_MS), now];
    if (taps.current.length >= VERSION_TAPS) {
      taps.current = [];
      open();
    }
  }, [open]);
  return allowed ? onPress : undefined;
}

/** 설정 화면의 버전 줄용: 이 빌드 환경으로 판정한 탭 처리(production 이면 undefined) */
export function useAppVersionTaps(): (() => void) | undefined {
  return useVersionTaps(isDevMenuAllowed(getAppEnv().APP_ENV, typeof __DEV__ === 'undefined' ? true : __DEV__));
}
