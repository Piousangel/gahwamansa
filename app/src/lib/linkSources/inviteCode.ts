// 카톡 초대 링크에서 가족 번호(6자리)를 꺼내고, 기기에 둘 상태를 다루는 순수 함수.
// React·RN 을 모른다 — 토스·iOS·contracts 쪽은 이 파일만 import 한다(RN 연결은 ./native.ts).
// 경로: 자녀 공유 링크 https://<도메인>/c#123456
//   - 앱 있음: App Links → Linking 이 받은 URL 의 조각(#)에서 번호
//     (/c 페이지 intent:// 버튼은 S.code 엑스트라로 보내고 MainActivity 가 조각으로 옮겨 같은 모양이 된다)
//   - 앱 없음: /c 페이지 JS 가 조각을 읽어 Play 링크 referrer=code%3D123456 으로 보냄 → 첫 실행 Install Referrer 1회
// 번호는 민감 값: 분석 이벤트·로그에 넣지 않는다(inviteAnalyticsEvent 는 출처만). 저장은 앱 전용 저장소(native.ts).
// 스파이크: docs/team/spikes/2026-11-17-install-referrer-applinks.md
import {sha256Hex} from '../sha256';

// 서버 0029 log_event source 값과 같은 글자(app_link·referrer)
export type InviteSource = 'app_link' | 'referrer';
export type PendingInvite = {code: string; source: InviteSource};

// Play 클릭이 이보다 오래면 채우지 않는다(번호 최대 유효 기간 = 초대 번호 7일, 서버 0018)
export const INVITE_TTL_SEC = 7 * 24 * 60 * 60;
// 기기에 들고 있는 최대 기간. 번호가 실제로 유효한지는 서버가 정한다(재연결 번호는 24시간 등) — P1c 의 peek 로 확인
export const INVITE_KEEP_SEC = INVITE_TTL_SEC;
const HANDLED_MAX = 20;

const CODE_RE = /^\d{6}$/;

// "123 456", "123-456" 처럼 사람이 읽기 좋게 나눈 모양까지 허용, 그 외 글자가 섞이면 버린다
export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const s = raw.replace(/[\s-]/g, '');
  return CODE_RE.test(s) ? s : null;
}

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

function queryParam(query: string, key: string): string | null {
  for (const part of query.split('&')) {
    const i = part.indexOf('=');
    if (i > 0 && safeDecode(part.slice(0, i)) === key) {
      return safeDecode(part.slice(i + 1));
    }
  }
  return null;
}

// https://<allowedHost>/c#123456 (끝 슬래시 허용). 번호는 조각에서만 읽는다(쿼리는 서버 접근 기록에 남으므로 받지 않음).
// allowedHost 가 비면(도메인 미정) 아무것도 받지 않는다. 다른 앱이 명시적 인텐트로 다른 도메인을 보내도 무시(리뷰 M3).
export function codeFromInviteLink(url: unknown, allowedHost: string): string | null {
  if (typeof url !== 'string' || !allowedHost) {
    return null;
  }
  const m = /^https:\/\/([^/?#:]+)(?::\d+)?\/c\/?(?:\?[^#]*)?#(.+)$/i.exec(url.trim());
  if (!m || m[1].toLowerCase() !== allowedHost.toLowerCase()) {
    return null;
  }
  const frag = safeDecode(m[2]);
  return frag === null ? null : normalizeInviteCode(frag);
}

// Play referrer 값: "code=123456"(Play 가 한 번 풀어 준 값). 다른 파라미터(utm_*)가 섞여도 code 만.
// 일부 경로에서 한 번 더 인코딩된 채("code%3D123456") 오기도 해서 '=' 가 없으면 한 번 풀어 본다.
export function codeFromInstallReferrer(
  referrer: unknown,
  clickTs?: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): string | null {
  if (typeof referrer !== 'string' || referrer.length === 0 || referrer.length > 512) {
    return null;
  }
  let body: string = referrer;
  if (!body.includes('=')) {
    const once = safeDecode(body);
    if (once === null) {
      return null;
    }
    body = once;
  }
  if (typeof clickTs === 'number' && clickTs > 0 && nowSec - clickTs > INVITE_TTL_SEC) {
    return null;
  }
  return normalizeInviteCode(queryParam(body, 'code'));
}

// ---- 기기 저장 상태: 어르신 첫 화면 "가족이 보낸 번호가 있어요" 띠에 쓸 값 ----
// 자동 연결 금지(DECISIONS 11-17): 이 값은 P1c 확인 화면에 "미리 채울" 번호일 뿐, 연결은 사용자가 누른다.
// pending: 아직 안 쓴 번호(만료 시각 포함). handled: 이미 처리한 "시작 링크"의 해시(번호 원문 저장 안 함) —
// 최근 앱 목록에서 다시 열면 Android 가 처음 인텐트를 또 주므로 그걸 걸러 낸다(리뷰 M2).
export type StoredInvite = PendingInvite & {expiresAt: number};
export type InviteStore = {v: 1; pending: StoredInvite | null; handled: Array<{h: string; exp: number}>};
export const EMPTY_INVITE_STORE: InviteStore = {v: 1, pending: null, handled: []};

export function inviteLinkId(url: string): string {
  return sha256Hex(`invite-link:${url}`);
}

function prune(s: InviteStore, nowSec: number): InviteStore {
  const pending = s.pending && s.pending.expiresAt > nowSec ? s.pending : null;
  const handled = s.handled.filter(x => x.exp > nowSec);
  if (pending === s.pending && handled.length === s.handled.length) {
    return s;
  }
  return {v: 1, pending, handled};
}

export function applyInvite(
  store: InviteStore,
  invite: PendingInvite,
  opts: {nowSec: number; clickTs?: number; initialLinkId?: string},
): InviteStore {
  const {nowSec, clickTs, initialLinkId} = opts;
  const s = prune(store, nowSec);
  if (initialLinkId && s.handled.some(x => x.h === initialLinkId)) {
    return s;
  }
  const handled = initialLinkId
    ? [...s.handled, {h: initialLinkId, exp: nowSec + INVITE_KEEP_SEC}].slice(-HANDLED_MAX)
    : s.handled;
  const from = invite.source === 'referrer' && clickTs && clickTs > 0 ? clickTs : nowSec;
  const expiresAt = from + INVITE_KEEP_SEC;
  const cur = s.pending;
  // 이미 링크로 받은 번호가 있으면 설치 경로 번호(더 오래된 클릭)로 덮지 않는다. 새 링크는 덮는다(사용자가 방금 누름)
  const keep =
    expiresAt <= nowSec ||
    (cur && cur.source === 'app_link' && invite.source === 'referrer') ||
    (cur && cur.code === invite.code && cur.source === invite.source);
  if (keep && handled === s.handled) {
    return s;
  }
  return {v: 1, pending: keep ? cur : {...invite, expiresAt}, handled};
}

// 연결에 썼거나 "다른 번호 쓰기"로 치웠다 → 번호 삭제
export function consumeInviteStore(store: InviteStore): InviteStore {
  return store.pending ? {...store, pending: null} : store;
}

export function familyCodeBanner(
  store: InviteStore,
  nowSec: number,
): {visible: boolean; code: string | null; source: InviteSource | null} {
  const p = store.pending;
  return p && p.expiresAt > nowSec ? {visible: true, code: p.code, source: p.source} : {visible: false, code: null, source: null};
}

export function serializeInviteStore(store: InviteStore): string {
  return JSON.stringify(store);
}

// 깨졌거나 모르는 모양이면 빈 상태(번호를 잘못 띄우느니 안 띄운다). 만료된 건 버린다
export function parseInviteStore(raw: string | null | undefined, nowSec: number): InviteStore {
  if (!raw) {
    return EMPTY_INVITE_STORE;
  }
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return EMPTY_INVITE_STORE;
  }
  if (!o || typeof o !== 'object' || (o as {v?: unknown}).v !== 1) {
    return EMPTY_INVITE_STORE;
  }
  const {pending: p, handled: h} = o as {pending?: unknown; handled?: unknown};
  let pending: StoredInvite | null = null;
  if (p && typeof p === 'object') {
    const q = p as Record<string, unknown>;
    const code = normalizeInviteCode(q.code);
    // 옛 저장값(install_referrer)은 referrer 로 읽는다
    const source: InviteSource | null =
      q.source === 'app_link' ? 'app_link' : q.source === 'referrer' || q.source === 'install_referrer' ? 'referrer' : null;
    if (!code || !source || typeof q.expiresAt !== 'number') {
      return EMPTY_INVITE_STORE;
    }
    pending = {code, source, expiresAt: q.expiresAt};
  }
  const handled = Array.isArray(h)
    ? h
        .filter(
          (x): x is {h: string; exp: number} =>
            !!x && typeof x.h === 'string' && /^[0-9a-f]{64}$/.test(x.h) && typeof x.exp === 'number',
        )
        .map(x => ({h: x.h, exp: x.exp}))
        .slice(-HANDLED_MAX)
    : [];
  return prune({v: 1, pending, handled}, nowSec);
}

// 분석 이벤트(서버 0029 code_prefilled{source}): 번호 값은 절대 넣지 않는다. 출처만
export function inviteAnalyticsEvent(invite: PendingInvite): {
  name: 'code_prefilled';
  params: {source: InviteSource};
} {
  return {name: 'code_prefilled', params: {source: invite.source}};
}
