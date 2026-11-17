// RN 연결부: 초대 번호의 두 출처(App Links 딥링크, Play Install Referrer)를 앱 전용 저장소와 묶는다.
// RN(Linking·NativeModules)에 의존한다 → 토스·contracts 는 ./inviteCode 만 import 할 것(리뷰 L6).
// 사용(화면 줄): 앱 루트에서 startInviteSources() 를 한 번, 어르신 첫 화면은 subscribeInvite 로 띠 값을 받고,
//   연결 성공·"다른 번호 쓰기" 때 consumeInvite(). UI 는 이 파일 범위 밖.
// 저장: Android 앱 전용 SharedPreferences(InviteModule, MODE_PRIVATE). AsyncStorage(다른 데이터와 같은 DB)는 쓰지 않는다.
// 로그·분석 금지: 이 파일은 console 을 쓰지 않고, 예외는 삼킨다(메시지에 번호가 실리지 않게).
import {Linking, NativeModules, Platform} from 'react-native';
import {getAppEnv} from '../env';
import {
  EMPTY_INVITE_STORE,
  applyInvite,
  codeFromInstallReferrer,
  codeFromInviteLink,
  consumeInviteStore,
  familyCodeBanner,
  inviteLinkId,
  parseInviteStore,
  serializeInviteStore,
  type InviteStore,
  type PendingInvite,
} from './inviteCode';

type InviteNative = {
  getReferrerOnce(): Promise<{referrer: string; clickTs: number} | null>;
  readStore(): Promise<string | null>;
  writeStore(value: string | null): Promise<void>;
};
export type InviteBanner = {visible: boolean; code: string | null};

const nowSec = () => Math.floor(Date.now() / 1000);
const native = (): Partial<InviteNative> | undefined =>
  Platform.OS === 'android' ? (NativeModules as {InviteModule?: Partial<InviteNative>}).InviteModule : undefined;

let store: InviteStore = EMPTY_INVITE_STORE;
let started: Promise<void> | null = null;
let queue: Promise<void> = Promise.resolve();
let hostOverride: string | null = null;
const listeners = new Set<(b: InviteBanner) => void>();

const appLinkHost = () => (hostOverride !== null ? hostOverride : getAppEnv().APP_LINK_HOST);
const banner = () => familyCodeBanner(store, nowSec());
const emit = () => {
  const b = banner();
  listeners.forEach(l => l(b));
};

// 상태 변경은 한 줄로 세운다(시작 링크·새 링크·referrer 가 겹쳐 와도 저장 순서가 꼬이지 않게)
function update(fn: (s: InviteStore) => InviteStore): Promise<void> {
  queue = queue
    .then(async () => {
      const next = fn(store);
      if (next === store) {
        return;
      }
      store = next;
      emit();
      await native()?.writeStore?.(next.pending || next.handled.length ? serializeInviteStore(next) : null);
    })
    .catch(() => {});
  return queue;
}

// 설치 후 첫 실행에 1회만 의미 있다(두 번째부터 네이티브가 null). 실패해도 throw 하지 않는다
export async function readInstallReferrerOnce(): Promise<{invite: PendingInvite; clickTs: number} | null> {
  const mod = native();
  if (!mod?.getReferrerOnce) {
    return null;
  }
  try {
    const r = await mod.getReferrerOnce();
    const code = r ? codeFromInstallReferrer(r.referrer, r.clickTs, nowSec()) : null;
    return code && r ? {invite: {code, source: 'install_referrer'}, clickTs: r.clickTs} : null;
  } catch {
    return null;
  }
}

function linkInvite(url: string | null | undefined): PendingInvite | null {
  const code = url ? codeFromInviteLink(url, appLinkHost()) : null;
  return code ? {code, source: 'app_link'} : null;
}

// 앱 수명 동안 한 번만(여러 번 불러도 같은 promise). 저장된 번호 복원 → 시작 링크(처리 ID 확인) → referrer
export function startInviteSources(): Promise<void> {
  if (started) {
    return started;
  }
  started = (async () => {
    let raw: string | null = null;
    try {
      raw = (await native()?.readStore?.()) ?? null;
    } catch {
      raw = null;
    }
    await update(() => parseInviteStore(raw, nowSec()));
    Linking.addEventListener('url', ({url}) => {
      const inv = linkInvite(url);
      if (inv) {
        update(s => applyInvite(s, inv, {nowSec: nowSec()}));
      }
    });
    let initial: string | null = null;
    try {
      initial = (await Linking.getInitialURL()) ?? null;
    } catch {
      initial = null;
    }
    const first = linkInvite(initial);
    if (first && initial) {
      const id = inviteLinkId(initial);
      await update(s => applyInvite(s, first, {nowSec: nowSec(), initialLinkId: id}));
    }
    const ref = await readInstallReferrerOnce();
    if (ref) {
      await update(s => applyInvite(s, ref.invite, {nowSec: nowSec(), clickTs: ref.clickTs}));
    }
  })();
  return started;
}

// 지금 값을 바로 한 번 주고, 바뀔 때마다 준다. 반환값으로 해제
export function subscribeInvite(listener: (b: InviteBanner) => void): () => void {
  listeners.add(listener);
  listener(banner());
  return () => {
    listeners.delete(listener);
  };
}

export function consumeInvite(): Promise<void> {
  return update(consumeInviteStore);
}

// 테스트 전용: 모듈 상태 초기화(프로세스 재시작 흉내)
export function __resetInviteSourcesForTests(opts: {appLinkHost: string}) {
  store = EMPTY_INVITE_STORE;
  started = null;
  queue = Promise.resolve();
  hostOverride = opts.appLinkHost;
  listeners.clear();
}
