// 약관 줄의 링크 두 개(감사 M7). 낱말은 앱 정보와 같은 문구, 주소는 appInfo(없으면 링크 모양 없이 글자로)
import {copy} from '../copy/copy';
import {PRIVACY_URL, TERMS_URL} from '../lib/appInfo';
import type {LegalLink} from '../ui/LegalText';

export function legalLinks(urls: {terms: string | null; privacy: string | null} = {terms: TERMS_URL, privacy: PRIVACY_URL}): LegalLink[] {
  return [
    {label: copy.app_info.terms, url: urls.terms},
    {label: copy.app_info.privacy, url: urls.privacy},
  ];
}
