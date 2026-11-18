// 푸시 실행 중 의존성 한 벌(브리지가 앱 시작 때 채운다). 화면 훅(자녀 useNotifyPermission 등)이 api 를 따로 받지 않고 쓰게.
import {defaultStore} from '../lib/kvStore';
import type {Api} from '../features/types';
import {childPermissionGranted, logPermissionResult, type PushDeps} from './pushClient';
import type {NotifyPermission} from './notifyNative';
import {nullTokenSource, type PushTokenSource} from './tokenSource';

let deps: PushDeps | null = null;

export function configurePush(api: Api, source: PushTokenSource = nullTokenSource): PushDeps {
  deps = {api, source, store: deps?.store ?? defaultStore()};
  return deps;
}
export function pushDeps(): PushDeps | null {
  return deps;
}
/** 테스트용 */
export function setPushDepsForTest(next: PushDeps | null) {
  deps = next;
}

/** 자녀 시스템 창 결과(C3 '알림 켜기'·C7). 허용이면 받기 동의 + 토큰 등록. 기록은 기다리지 않는다 */
export function childPermissionResult(p: NotifyPermission): Promise<void> {
  const d = deps;
  if (!d) {
    return Promise.resolve();
  }
  logPermissionResult(d.api, p);
  return p === 'granted' ? childPermissionGranted(d) : Promise.resolve();
}
