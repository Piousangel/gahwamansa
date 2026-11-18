// AC-03 N3 푸시를 눌러 앱을 열었을 때(자녀). 수신·리스너는 AU-04(푸시 클라이언트)가 붙이고, 여기서는 받은 data 로 무엇을 할지만 정한다.
// 서버 0038 메시지 data = {kind}(개인 id·번호 없음). 자녀가 받는 알림은 연결·재연결뿐(DECISIONS U11).
import {isQuietEventFailure, type EventProps} from '../../api/contract/events';
import type {Api} from '../types';

export type PushKind = NonNullable<EventProps['push_kind']>;
const KINDS: readonly PushKind[] = ['daily', 'cheer_arrived', 'parent_connected', 'parent_reconnected'];

export function parsePushKind(data: unknown): PushKind | null {
  const k = data && typeof data === 'object' ? (data as {kind?: unknown}).kind : null;
  return typeof k === 'string' && (KINDS as readonly string[]).includes(k) ? (k as PushKind) : null;
}

// 연결 알림을 눌러 들어오면 이미 알림으로 알았으니 앱 안 N3 배너는 한 번 건너뛴다(본 목록은 그대로 갱신)
let skipBanner = false;
export function takeSkipBanner(): boolean {
  const v = skipBanner;
  skipBanner = false;
  return v;
}

/** 자녀 알림 탭: push_opened{push_kind} 기록 → 연결 알림이면 앨범 탭으로. 모르는 kind 면 아무것도 하지 않는다 */
export function handleChildPushOpen(api: Api, data: unknown, toAlbum: () => void): PushKind | null {
  const kind = parsePushKind(data);
  if (!kind) {
    return null;
  }
  api
    .logEvent('push_opened', {push_kind: kind})
    .then(r => {
      if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
        console.warn(`[log_event] push_opened: ${r.reason}`);
      }
    })
    .catch(() => {});
  if (kind === 'parent_connected' || kind === 'parent_reconnected') {
    skipBanner = true;
    toAlbum();
  }
  return kind;
}
