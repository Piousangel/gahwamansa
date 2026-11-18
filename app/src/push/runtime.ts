// 푸시 실행 중 의존성 한 벌(PushHost 가 앱 시작 때 채운다). 화면(자녀 useNotifyPermission·P13·C7 토글)이 api 를 따로 받지 않고 쓰게.
// 화면이 쓰는 API(리뷰 M1): pushReceive()(서버 받기 상태 읽기), setPushReceive(on)(앱 안 끄기·켜기), childNotifyOptIn(p)(C3 '알림 켜기').
import {defaultStore} from '../lib/kvStore';
import type {Api} from '../features/types';
import {childOptIn, logPermissionResult, readReceive, setReceive, type PushDeps, type ReceiveResult} from './pushClient';
import {readNotifyPermission, type NotifyPermission} from './notifyNative';
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

/**
 * 자녀가 앱 안 '알림 켜기'(C3 줄)·C7 토글을 눌러 시스템 창을 지난 뒤(DECISIONS 11-18 리뷰 L2: 누른 것이 받기 동의).
 * 결과 기록 + 서버 받기 동의(set_push_enabled true) + 허용이면 토큰 등록. 기록은 기다리지 않는다.
 */
export function childNotifyOptIn(p: NotifyPermission): Promise<boolean> {
  const d = deps;
  if (!d) {
    return Promise.resolve(false);
  }
  logPermissionResult(d.api, p);
  return childOptIn(d, readNotifyPermission);
}

/** 서버 받기 상태(true 받는 중 · false 꺼짐/아직 · null 연결 전 · 'offline') — P13·C7 토글 초기값 */
export function pushReceive(): Promise<boolean | null | 'offline'> {
  return deps ? readReceive(deps) : Promise.resolve(null);
}

/** 앱 안 알림 끄기·켜기(P13 어르신·C7 자녀 토글). 실패는 값으로(offline·no_profile) */
export function setPushReceive(enabled: boolean): Promise<ReceiveResult> {
  return deps ? setReceive(deps, enabled, readNotifyPermission) : Promise.resolve({ok: false, reason: 'offline'});
}
