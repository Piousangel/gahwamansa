// 화면 밖(알림 탭·N1 띄우기)에서 쓰는 내비 참조 한 벌(AU-04). AppRoot 의 NavigationContainer 가 ref·onReady·onStateChange 로 연결한다.
// 지금 화면 이름은 useCurrentRouteName 으로 구독한다(화면을 import 하지 않음, ARCHITECTURE 7절).
import {useSyncExternalStore} from 'react';
import {createNavigationContainerRef, type ParamListBase} from '@react-navigation/native';

export const navRef = createNavigationContainerRef<ParamListBase>();

let current: string | undefined;
const listeners = new Set<() => void>();

/** NavigationContainer onReady·onStateChange 에서 부른다 */
export function emitRouteChange() {
  const next = navRef.isReady() ? navRef.getCurrentRoute()?.name : undefined;
  if (next !== current) {
    current = next;
    listeners.forEach(l => l());
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => current;

/** 지금 맨 위 화면 이름(내비가 준비 전이면 undefined) */
export function useCurrentRouteName(): string | undefined {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** 테스트용 */
export function resetRouteForTest() {
  current = undefined;
}
