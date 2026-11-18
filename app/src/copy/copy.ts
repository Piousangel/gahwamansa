// 문구는 한 곳에서만 가져온다. 원본: docs/team/copy.ko.json (이 폴더 copy.ko.json 은 그 사본, 갱신 시 덮어쓰기).
import copyJson from './copy.ko.json';

export const copy = copyJson;
export type FailReason =
  | 'invalid' | 'used' | 'expired' | 'rate_limited' | 'busy' | 'already_linked' | 'not_parent_device';
export const REASONS: FailReason[] = [
  'invalid', 'used', 'expired', 'rate_limited', 'busy', 'already_linked', 'not_parent_device',
];
export type Message = {title: string; body: string; button: string};

export function reasonToMessage(reason: FailReason): Message {
  return copy.errors[reason];
}
export const offlineMessage: Message = copy.errors.offline;

// 라이터 확정 문구는 copy.ko.json 의 app 키. 키가 없어 임시로 둔 문구는 없음.
export const appCopy = copy.app;

// 지금 화면에 보이는 동의 문구의 버전. consent 문구가 바뀌면 올린다(서버 형식 ^v[0-9]{1,3}$).
export const CONSENT_VERSION = 'v5'; // v3: 11-17 노출 고지 / v4: 11-19 '최근 한 달'·노출 줄 분리 / v5: 11-21 제17조② 5요소(받는 사람·목적·저장 기간·거부해도 사용)

// 호칭({호칭})을 채운다. 조사는 붙이지 않는 구조라 단순 치환이면 된다.
export const withTitle = (text: string, title: string) => text.split('{호칭}').join(title);
