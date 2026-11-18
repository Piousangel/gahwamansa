// 푸시 클라이언트 핵심(AU-04). React 를 모른다 — 화면·브리지가 부른다. 서버 계약: dev-server-notes 2절(0032·0036·0037).
// - 토큰: 권한이 있고 프로필이 있으면 등록(멱등) → 성공한 토큰만 lib/pushToken 에 둔다(로그아웃 때 realApi.signOut 이 해제).
// - 받기 동의(set_push_enabled true): 어르신은 N1 '알려 주세요'를 누를 때만, 자녀는 알림 권한이 허용됐을 때만(0036 받기 시각).
//   서버가 처음 시각을 유지하므로(0037) 다시 불러도 안전하지만, 원칙대로 그때만 부른다. 보내지 못하면 '보낼 일'로 기억했다가 다시.
import {isPushTokenShape} from '../api/contract/push';
import {isQuietEventFailure, type EventProps} from '../api/contract/events';
import type {Api} from '../features/types';
import {accountKey, PUSH_PROMPT_KEY} from '../lib/accountStore';
import type {KeyValueStore} from '../lib/kvStore';
import {readPushToken, savePushToken} from '../lib/pushToken';
import type {PushTokenSource} from './tokenSource';
import type {NotifyPermission} from './notifyNative';

export type PushDeps = {api: Api; source: PushTokenSource; store: KeyValueStore};
export type RegisterOutcome = 'ok' | 'no_token' | 'no_profile' | 'failed';

/** 이 기기 토큰을 서버에 등록. 권한 판단은 호출부(권한이 없으면 FCM 이 토큰을 주더라도 알림이 보이지 않는다) */
export async function registerToken({api, source}: PushDeps): Promise<RegisterOutcome> {
  let token: string | null;
  try {
    token = await source.getToken();
  } catch {
    return 'failed';
  }
  if (!isPushTokenShape(token)) {
    return 'no_token';
  }
  try {
    const r = await api.registerPushToken(token);
    if (r.ok) {
      if ((await readPushToken()) !== token) {
        await savePushToken(token);
      }
      return 'ok';
    }
    return r.reason === 'no_profile' ? 'no_profile' : 'failed';
  } catch {
    return 'failed';
  }
}

function track(api: Api, props: EventProps) {
  api
    .logEvent('push_permission_result', props)
    .then(r => {
      if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
        console.warn(`[log_event] push_permission_result: ${r.reason}`);
      }
    })
    .catch(() => {});
}

/** 시스템 창 결과 기록(0022 push_permission_result{result: granted|denied}). blocked·unknown 은 denied 로 센다 */
export function logPermissionResult(api: Api, p: NotifyPermission) {
  track(api, {result: p === 'granted' ? 'granted' : 'denied'});
}

async function tagOf(api: Api): Promise<string | null> {
  try {
    return await api.accountTag();
  } catch {
    return null;
  }
}

async function setEnabledTrue(api: Api): Promise<boolean> {
  try {
    return (await api.setPushEnabled(true)).ok;
  } catch {
    return false;
  }
}

export type ParentPromptAnswer = 'yes' | 'yes_pending' | 'no' | 'off';

async function readAnswer(store: KeyValueStore, key: string): Promise<string | null> {
  try {
    return await store.getItem(key);
  } catch {
    return null;
  }
}
async function writeAnswer(store: KeyValueStore, key: string, v: string) {
  await store.setItem(key, v).catch(() => {});
}

/** 어르신 N1 을 띄울지. 서버가 이미 받는 중이거나, 이 계정·이 기기에서 이미 답했으면 띄우지 않는다 */
export async function shouldPromptParent({api, store}: PushDeps): Promise<boolean> {
  let enabled: boolean | null;
  try {
    enabled = (await api.myPushSettings()).enabled;
  } catch {
    return false; // 오프라인이면 이번엔 묻지 않는다(다음 진입에 다시)
  }
  // 이미 받는 중(재설치 등)·연결 전(프로필 없음: 받기 동의를 남길 수 없음)이면 묻지 않는다
  if (enabled !== false) {
    return false;
  }
  const tag = await tagOf(api);
  return !!tag && !(await readAnswer(store, accountKey(PUSH_PROMPT_KEY, tag)));
}

/**
 * N1 '알려 주세요': 서버 받기 동의 → 시스템 창 → 허용이면 토큰 등록.
 * 서버 호출이 실패해도 시스템 창은 띄우고, 'yes_pending'으로 기억했다가 retryPending 이 다시 보낸다.
 * request 는 주입(테스트·플랫폼).
 */
export async function acceptParentPrompt(
  deps: PushDeps,
  request: () => Promise<NotifyPermission>,
): Promise<NotifyPermission> {
  const {api, store} = deps;
  const tag = await tagOf(api);
  const ok = await setEnabledTrue(api);
  if (tag) {
    await writeAnswer(store, accountKey(PUSH_PROMPT_KEY, tag), ok ? 'yes' : 'yes_pending');
  }
  const p = await request();
  logPermissionResult(api, p);
  if (p === 'granted') {
    await registerToken(deps);
  }
  return p;
}

/** N1 '괜찮아요': 서버 호출 없음(받기 시각이 없으면 보내지 않음). 다시 묻지 않는다 — 켜기는 P13 설정에서 */
export async function declineParentPrompt({api, store}: PushDeps): Promise<void> {
  const tag = await tagOf(api);
  if (tag) {
    await writeAnswer(store, accountKey(PUSH_PROMPT_KEY, tag), 'no');
  }
}

/**
 * 앞에서 보내지 못한 어르신 받기 동의를 다시 보낸다(앱 시작·앞으로 돌아올 때). 리뷰 L3: 서버 값이 먼저 —
 * 이미 받는 중이면 기억만 고치고, 연결 전이면 두고, 끈 경우(P13 토글 → 'off')는 'yes_pending' 이 아니므로 다시 켜지 않는다.
 */
export async function retryPending({api, store}: PushDeps): Promise<void> {
  const tag = await tagOf(api);
  if (!tag) {
    return;
  }
  const key = accountKey(PUSH_PROMPT_KEY, tag);
  if ((await readAnswer(store, key)) !== 'yes_pending') {
    return;
  }
  let enabled: boolean | null;
  try {
    enabled = (await api.myPushSettings()).enabled;
  } catch {
    return; // 오프라인: 다음 기회에
  }
  if (enabled === true || (enabled === false && (await setEnabledTrue(api)))) {
    await writeAnswer(store, key, 'yes');
  }
}

/**
 * 자녀 받기 동의(DECISIONS 11-18 리뷰 L2): 앱 안에서 '알림 켜기'(C3 줄)·C7 토글을 **눌렀을 때만** 부른다 — 권한 허용만으로는 기록하지 않음.
 * 서버 동의 → 권한이 허용이면 토큰 등록. 서버 호출이 실패하면 false(호출부가 다시 누를 수 있게 둔다).
 */
export async function childOptIn(deps: PushDeps, permission: () => Promise<NotifyPermission>): Promise<boolean> {
  const ok = await setEnabledTrue(deps.api);
  if ((await permission()) === 'granted') {
    await registerToken(deps);
  }
  return ok;
}

export type ReceiveResult = {ok: true; enabled: boolean} | {ok: false; reason: 'offline' | 'no_profile' | 'invalid'};

/**
 * 앱 안 알림 끄기·켜기(리뷰 M1: P13 어르신 채널 토글·C7 자녀 '가족 연결' 토글이 부른다). 서버 set_push_enabled(0036·0037).
 * 끄면 받기 시각이 지워지고(발송 대상 아님) 이 계정의 N1 기억은 'off'(다시 묻지 않음·재시도로 다시 켜지 않음).
 * 켜면 'yes' + 권한이 허용이면 토큰 등록. 토큰 해제는 하지 않는다(해제는 로그아웃용, dev-server-notes §2).
 */
export async function setReceive(deps: PushDeps, enabled: boolean, permission: () => Promise<NotifyPermission>): Promise<ReceiveResult> {
  const {api, store} = deps;
  let r;
  try {
    r = await api.setPushEnabled(enabled);
  } catch {
    return {ok: false, reason: 'offline'};
  }
  if (!r.ok) {
    return r;
  }
  const tag = await tagOf(api);
  if (tag) {
    await writeAnswer(store, accountKey(PUSH_PROMPT_KEY, tag), enabled ? 'yes' : 'off');
  }
  if (enabled && (await permission()) === 'granted') {
    await registerToken(deps);
  }
  return {ok: true, enabled: r.enabled};
}

/** 지금 서버 받기 상태(켬 + 받기 시각). 연결 전 null, 오프라인 'offline' — P13·C7 토글 초기값 */
export async function readReceive({api}: PushDeps): Promise<boolean | null | 'offline'> {
  try {
    return (await api.myPushSettings()).enabled;
  } catch {
    return 'offline';
  }
}
