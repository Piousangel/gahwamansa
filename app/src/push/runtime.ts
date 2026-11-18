// 푸시 실행 중 의존성 한 벌(PushHost 가 앱 시작 때 채운다). 화면(자녀 useNotifyPermission·P13·C7 토글)이 api 를 따로 받지 않고 쓰게.
// 화면이 쓰는 API(리뷰 M1): pushReceive()(서버 받기 상태 읽기), setPushReceive(on)(앱 안 끄기·켜기), childNotifyOptIn(p)(C3 '알림 켜기').
import {defaultStore} from '../lib/kvStore';
import type {Api} from '../features/types';
import {childOptIn, logPermissionResult, readReceive, setReceive, type PushDeps, type ReceiveResult} from './pushClient';
import {readNotifyPermission, requestNotifyPermission, type NotifyPermission} from './notifyNative';
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

/**
 * P13 어르신 '알림' 켜기(l2-appinfo 리뷰 M1): N1 '알려 주세요'와 같은 순서 — set_push_enabled(true) → 권한 창(13+ 묻기 전·한 번 거절이면 뜬다)
 * → 허용이면 토큰 등록. N1 '괜찮아요'로 묻지 않은 기기도 앱 안에서 켤 수 있다. 결과 권한을 함께 돌려준다(blocked 면 호출부가 휴대폰 설정을 연다).
 * request 는 주입(테스트).
 */
export async function parentEnableFromSettings(
  request: () => Promise<NotifyPermission> = requestNotifyPermission,
): Promise<{result: ReceiveResult; permission: NotifyPermission | null}> {
  const d = deps;
  if (!d) {
    return {result: {ok: false, reason: 'offline'}, permission: null};
  }
  let permission: NotifyPermission | null = null;
  const result = await setReceive(d, true, async () => {
    permission = await request();
    return permission;
  });
  if (permission) {
    logPermissionResult(d.api, permission);
  }
  return {result, permission};
}

/**
 * P13 '켜 둔 상태 + 권한 denied' 줄의 [알려 주세요](l2-appinfo 재확인 N2): 권한 창 → 결과 기록(push_permission_result, 값 없음)
 * → 허용이면 받기 상태 확인·토큰 등록(set_push_enabled(true) — 0037 처음 시각 유지). 결과를 돌려준다(실패면 호출부가 한 줄).
 */
export async function parentAskPermissionAgain(
  request: () => Promise<NotifyPermission> = requestNotifyPermission,
): Promise<{permission: NotifyPermission; result: ReceiveResult | null}> {
  const permission = await request();
  const d = deps;
  if (!d) {
    return {permission, result: null};
  }
  logPermissionResult(d.api, permission);
  if (permission !== 'granted') {
    return {permission, result: null};
  }
  const result = await setReceive(d, true, async () => permission);
  return {permission, result};
}
