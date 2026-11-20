import {Linking} from 'react-native';
import {copy} from '../../copy/copy';
import {readAppInfo} from '../../lib/appInfo';

// '문의하기' 메일 열기 한 벌(앱 정보 ContactRow·계정 지우기 어르신 안내, #153). 제목은 열람·정정·삭제 요청(법률 Q4).
// 주소(CONTACT_EMAIL)가 정해지지 않았으면 null — 화면은 app_info.contact_pending 한 줄을 보인다.
export function contactMailUrl(mail: string): string {
  return `mailto:${mail}?subject=${encodeURIComponent(copy.app_info.contact_request_subject)}`;
}

export function contactMail(): string | null {
  return readAppInfo().contactEmail;
}

export function openContactMail(mail: string) {
  Linking.openURL(contactMailUrl(mail)).catch(() => {});
}
