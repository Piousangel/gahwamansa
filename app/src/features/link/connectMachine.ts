// P1 번호 쓰기 → P1c 연결 확인 상태 머신(순수 함수, ease-and-joy A④⑤).
// idle(쓰는 중) → peeking(6자리 300ms 뒤 확인) → confirm(누가 보낸 번호인지 보여 줌) → redeeming → ok
// 실패: invalid 는 숫자를 그대로 두고 칸 아래 한 줄(idle.inline), 그 밖은 안내 패널(failed). 자동 연결 금지(confirm 에서 사람이 누른다).
import type {FailReason} from '../../copy/copy';
import type {PeekResult, RedeemResult} from '../types';

export const AUTO_CHECK_MS = 300;

export type FailKind = Exclude<FailReason, 'invalid' | 'rate_limited'> | 'locked' | 'offline' | 'server';
export type Step = 'peek' | 'redeem';
export type ConnectState =
  | {kind: 'idle'; code: string; inline: 'invalid' | null}
  | {kind: 'peeking'; code: string}
  | {kind: 'confirm'; code: string; title: string}
  | {kind: 'redeeming'; code: string; title: string}
  | {kind: 'ok'; code: string}
  | {kind: 'failed'; code: string; reason: FailKind; step: Step; title?: string; retryAfterSec?: number};

export type ConnectEvent =
  | {type: 'edit'; code: string}
  | {type: 'peek'}
  | {type: 'peeked'; result: PeekResult}
  | {type: 'redeem'}
  | {type: 'redeemed'; result: RedeemResult}
  | {type: 'error'; offline: boolean}
  | {type: 'other'} // 다른 번호 쓰기: 비우고 처음부터
  | {type: 'retry'}; // 안내 패널의 버튼(다시 하기·알겠어요)

export const initialConnect = (code = ''): ConnectState => ({kind: 'idle', code, inline: null});

// 6자리를 다 썼고 안내 줄이 없으면 자동 확인 대상
export const shouldAutoCheck = (s: ConnectState) => s.kind === 'idle' && s.inline === null && /^[0-9]{6}$/.test(s.code);

function failKind(reason: FailReason): FailKind | 'invalid' {
  return reason === 'rate_limited' ? 'locked' : reason;
}

export function connectReducer(s: ConnectState, e: ConnectEvent): ConnectState {
  switch (e.type) {
    case 'edit':
      // 쓰는 중에는 언제든 고칠 수 있다(확인 중이면 그 확인은 버린다). 고치면 안내 줄은 사라진다
      return s.kind === 'idle' || s.kind === 'peeking' ? {kind: 'idle', code: e.code, inline: null} : s;
    case 'peek':
      return shouldAutoCheck(s) || (s.kind === 'failed' && s.step === 'peek') ? {kind: 'peeking', code: s.code} : s;
    case 'peeked': {
      if (s.kind !== 'peeking') {
        return s;
      }
      if (e.result.ok) {
        return {kind: 'confirm', code: s.code, title: e.result.parentTitle};
      }
      const k = failKind(e.result.reason);
      return k === 'invalid'
        ? {kind: 'idle', code: s.code, inline: 'invalid'} // 숫자는 그대로
        : {kind: 'failed', code: s.code, reason: k, step: 'peek', retryAfterSec: e.result.retry_after_sec};
    }
    case 'redeem':
      if (s.kind === 'confirm' || (s.kind === 'failed' && s.step === 'redeem' && s.title)) {
        return {kind: 'redeeming', code: s.code, title: s.title as string};
      }
      return s;
    case 'redeemed': {
      if (s.kind !== 'redeeming') {
        return s;
      }
      if (e.result.ok) {
        return {kind: 'ok', code: s.code};
      }
      const k = failKind(e.result.reason);
      return k === 'invalid'
        ? {kind: 'idle', code: s.code, inline: 'invalid'}
        : {kind: 'failed', code: s.code, reason: k, step: 'redeem', title: s.title, retryAfterSec: e.result.retry_after_sec};
    }
    case 'error':
      if (s.kind === 'peeking') {
        return {kind: 'failed', code: s.code, reason: e.offline ? 'offline' : 'server', step: 'peek'};
      }
      if (s.kind === 'redeeming') {
        return {kind: 'failed', code: s.code, reason: e.offline ? 'offline' : 'server', step: 'redeem', title: s.title};
      }
      return s;
    case 'other':
      return initialConnect();
    case 'retry':
      if (s.kind !== 'failed') {
        return s;
      }
      // 인터넷·서버 문제는 같은 단계를 다시, 번호 문제(기간 지남·쓴 번호·잠김)는 비우고 처음부터
      if (s.reason === 'offline' || s.reason === 'server' || s.reason === 'busy') {
        return s.step === 'peek' ? {kind: 'peeking', code: s.code} : {kind: 'redeeming', code: s.code, title: s.title ?? ''};
      }
      return initialConnect();
  }
}
