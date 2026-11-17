// 초대 번호를 들고 오는 두 출처(App Links 딥링크, Play Install Referrer)를 한 구독으로 묶는다.
// React 를 모른다: 화면 줄은 이 subscribe 를 Provider/훅에서 불러 inviteReducer 로 상태를 만든다(UI 는 이 파일 범위 밖).
// iOS·Play 없는 기기에서는 referrer 가 조용히 null.
import {Linking, NativeModules, Platform} from 'react-native';
import {codeFromInstallReferrer, codeFromInviteLink, type PendingInvite} from './inviteCode';

export * from './inviteCode';

type ReferrerNative = {getOnce(): Promise<{referrer: string; clickTs: number} | null>};

// 설치 후 첫 실행에 1회만 의미 있다(두 번째부터 네이티브가 null). 실패해도 throw 하지 않는다
export async function readInstallReferrerOnce(nowSec?: number): Promise<PendingInvite | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  const mod = (NativeModules as {InstallReferrerModule?: ReferrerNative}).InstallReferrerModule;
  if (!mod) {
    return null;
  }
  try {
    const r = await mod.getOnce();
    const code = r ? codeFromInstallReferrer(r.referrer, r.clickTs, nowSec) : null;
    return code ? {code, source: 'install_referrer'} : null;
  } catch {
    return null;
  }
}

function fromUrl(url: string | null | undefined): PendingInvite | null {
  const code = url ? codeFromInviteLink(url) : null;
  return code ? {code, source: 'app_link'} : null;
}

// 앱 시작 링크 + 실행 중 새 링크 + (첫 실행) 설치 referrer 를 listener 로 보낸다. 반환값으로 구독 해제
export function subscribeInviteCodes(listener: (invite: PendingInvite) => void): () => void {
  let active = true;
  const emit = (inv: PendingInvite | null) => {
    if (active && inv) {
      listener(inv);
    }
  };
  const sub = Linking.addEventListener('url', ({url}) => emit(fromUrl(url)));
  Linking.getInitialURL()
    .then(url => emit(fromUrl(url)))
    .catch(() => {});
  readInstallReferrerOnce().then(emit);
  return () => {
    active = false;
    sub.remove();
  };
}
