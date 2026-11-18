import {useCallback, useRef, useState} from 'react';
import {openInAppWeb, type OpenResult, type WebTarget} from './appLink';
import type {AppInfo} from '../lib/appInfo';

/**
 * 약관·방침 행이 쓰는 열기 훅(AU-07, 웹뷰 리뷰 L5): 인터넷 확인(최대 4초) 동안 `busy` 로 그 행에 진행 표시·두 번 누름 막기.
 * 결과 'offline' 이면 호출부가 app_info.link_offline(어르신 Banner·자녀 Toast)을 띄운다. 예:
 *   const web = useInAppWeb(t => navigation.navigate('Web', {target: t}));
 *   <Row loading={web.busy === 'terms'} onPress={async () => (await web.open('terms')) === 'offline' && showOffline()} />
 */
export function useInAppWeb(navigate: (target: WebTarget) => void, check?: (url: string) => Promise<boolean>, info?: AppInfo) {
  const [busy, setBusy] = useState<WebTarget | null>(null);
  const lock = useRef(false);
  const open = useCallback(
    async (target: WebTarget): Promise<OpenResult | 'busy'> => {
      if (lock.current) {
        return 'busy';
      }
      lock.current = true;
      setBusy(target);
      try {
        return await openInAppWeb(target, navigate, check, info);
      } finally {
        lock.current = false;
        setBusy(null);
      }
    },
    [navigate, check, info],
  );
  return {open, busy};
}
