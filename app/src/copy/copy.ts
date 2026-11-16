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
  del: {
    link: '설정 · 데이터 지우기',
    parentWarn: '지금까지 고른 답과 기록이 지워져요',
    parentWarn2: '되돌릴 수 없어요',
    parentStart: '지우기',
    parentAsk: '정말 지울까요?',
    parentYes: '네, 지울게요',
    cancel: '그만둘래요',
    childWarn: '마지막 보호자라서 어르신의 기록까지 모두 지워져요',
    childWarn2: '되돌릴 수 없어요',
    childOnlyMe: '내 계정만 지워져요',
    childStart: '삭제하기',
    childTypeHint: "확인을 위해 '삭제'라고 써 주세요",
    childTypeWord: '삭제',
    childYes: '네, 삭제할게요',
    failTitle: '아직 지워지지 않았어요',
    failBody: '아무것도 지워지지 않았어요. 다시 해 볼까요?',
    doneParent: '내 기록이 지워졌어요',
    doneChild: '내 계정이 삭제되었어요',
    doneFamily: '가족 전체가 삭제되었어요',
    back: '처음으로',
    childLoginTitle: '다시 로그인해 주세요',
  },
  serverError: {title: '앱이 잠깐 헷갈렸어요', body: '잠시 뒤에 다시 해 볼까요?', button: '다시 하기'},
};
