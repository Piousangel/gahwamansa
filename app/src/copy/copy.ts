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

// 임시 문구(라이터 확정 필요, dev-app-notes.md 6e 참고)
export const tempCopy = {
  serverError: {title: '앱이 잠깐 헷갈렸어요', body: '잠시 뒤에 다시 해 볼까요?', button: '다시 하기'},
};
