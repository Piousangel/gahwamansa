// 앱 안 웹 화면 열기(AU-07, DECISIONS 11-18: 약관·방침은 앱 안에서, 외부 브라우저로 내보내지 않음). React 를 모른다.
// 오프라인이면 화면을 열지 않고 호출부가 '인터넷이 연결되면 볼 수 있어요'(app_info.link_offline)를 띄운다(어르신 Banner·자녀 Toast).
import {readAppInfo, type AppInfo} from '../lib/appInfo';

export type WebTarget = 'terms' | 'privacy';

/** 열어도 되는 주소: 앱 정보 상수(env)의 약관·방침 URL 뿐(내비 파라미터로 다른 주소를 열지 못하게) */
export function allowedWebUrl(target: WebTarget, info = readAppInfo()): string | null {
  return target === 'terms' ? info.termsUrl : info.privacyUrl;
}

/** 그 주소에 닿는지 짧게 확인(HEAD, 4초). 응답이 오면(상태 무관) true, 네트워크 실패·시간 초과면 false */
export async function canReach(url: string, timeoutMs = 4000): Promise<boolean> {
  const ctrl = typeof AbortController === 'undefined' ? null : new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>(resolve => {
    timer = setTimeout(() => {
      ctrl?.abort();
      resolve(false);
    }, timeoutMs);
  });
  const probe = fetch(url, {method: 'HEAD', signal: ctrl?.signal}).then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type OpenResult = 'opened' | 'offline' | 'unavailable';

/**
 * 약관·방침 열기. 값이 없으면 'unavailable'(행이 숨겨져 있어야 정상), 오프라인이면 'offline'(열지 않음),
 * 아니면 navigate('Web', {target}) 를 부르고 'opened'.
 */
export async function openInAppWeb(
  target: WebTarget,
  navigate: (target: WebTarget) => void,
  check: (url: string) => Promise<boolean> = canReach,
  info: AppInfo = readAppInfo(),
): Promise<OpenResult> {
  const url = allowedWebUrl(target, info);
  if (!url) {
    return 'unavailable';
  }
  if (!(await check(url))) {
    return 'offline';
  }
  navigate(target);
  return 'opened';
}
