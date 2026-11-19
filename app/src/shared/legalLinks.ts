// 약관 줄의 링크 두 개(감사 M7). 낱말은 앱 정보와 같은 문구, 주소는 appInfo(없으면 링크 모양 없이 글자로).
// 누르면 앱 안 웹 화면(AU-07 useInAppWeb, 재확인 3 M5) — 인터넷이 안 닿으면 호출부가 Banner(app_info.link_offline)를 보인다.
import {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {copy} from '../copy/copy';
import {PRIVACY_URL, TERMS_URL} from '../lib/appInfo';
import type {LegalLink} from '../ui/LegalText';
import {useInAppWeb} from './useInAppWeb';
import type {WebTarget} from './appLink';

export function legalLinks(urls: {terms: string | null; privacy: string | null} = {terms: TERMS_URL, privacy: PRIVACY_URL}): LegalLink[] {
  return [
    {label: copy.app_info.terms, url: urls.terms, key: 'terms'},
    {label: copy.app_info.privacy, url: urls.privacy, key: 'privacy'},
  ];
}

/** 약관 줄(LegalText)에 넘길 onOpen + 오프라인 상태(재확인 4 M7: 화면 읽기 알림만이 아니라 앱 정보 행처럼 Banner 로 보인다).
 *  어르신·자녀 스택 공통 라우트 'Web'(app/ 를 import 하지 않으려 최소 타입만). 화면에 다시 들어오면 오프라인 줄을 지운다 */
export function useLegalOpen(): {open: (url: string, label: string, key?: string) => void; offline: boolean} {
  const navigation = useNavigation<NativeStackNavigationProp<{Web: {target: WebTarget}}>>();
  const web = useInAppWeb(target => navigation.navigate('Web', {target}));
  const [offline, setOffline] = useState(false);
  useEffect(() => navigation.addListener?.('focus', () => setOffline(false)), [navigation]);
  const open = useCallback(
    (_url: string, _label: string, key?: string) => {
      if (key !== 'terms' && key !== 'privacy') {
        return;
      }
      setOffline(false);
      web.open(key).then(r => {
        if (r === 'offline') {
          setOffline(true);
        }
      });
    },
    [web],
  );
  return {open, offline};
}
