// 약관 줄의 링크 두 개(감사 M7). 낱말은 앱 정보와 같은 문구, 주소는 appInfo(없으면 링크 모양 없이 글자로).
// 누르면 앱 안 웹 화면(AU-07 useInAppWeb, 재확인 3 M5) — 인터넷이 안 닿으면 화면 읽기로 한 줄 알린다.
import {useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {copy} from '../copy/copy';
import {PRIVACY_URL, TERMS_URL} from '../lib/appInfo';
import type {LegalLink} from '../ui/LegalText';
import {announce} from '../ui/a11y';
import {useInAppWeb} from './useInAppWeb';
import type {WebTarget} from './appLink';

export function legalLinks(urls: {terms: string | null; privacy: string | null} = {terms: TERMS_URL, privacy: PRIVACY_URL}): LegalLink[] {
  return [
    {label: copy.app_info.terms, url: urls.terms, key: 'terms'},
    {label: copy.app_info.privacy, url: urls.privacy, key: 'privacy'},
  ];
}

/** 약관 줄(LegalText)에 넘길 onOpen: 어르신·자녀 스택 공통 라우트 'Web'(app/ 를 import 하지 않으려 최소 타입만) */
export function useLegalOpen(): (url: string, label: string, key?: string) => void {
  const navigation = useNavigation<NativeStackNavigationProp<{Web: {target: WebTarget}}>>();
  const web = useInAppWeb(target => navigation.navigate('Web', {target}));
  return useCallback(
    (_url: string, _label: string, key?: string) => {
      if (key !== 'terms' && key !== 'privacy') {
        return;
      }
      web.open(key).then(r => {
        if (r === 'offline') {
          announce(copy.app_info.link_offline);
        }
      });
    },
    [web],
  );
}
