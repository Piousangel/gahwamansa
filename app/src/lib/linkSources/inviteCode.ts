// 카톡 초대 링크에서 가족 번호(6자리)를 꺼내는 순수 함수. React·RN 을 모른다(토스·iOS 에서도 그대로 쓰게).
// 경로: 자녀 공유 링크 https://<도메인>/c#123456
//   - 앱 있음: App Links → Linking 이 받은 URL 의 조각(#)에서 번호
//   - 앱 없음: /c 페이지 JS 가 조각을 읽어 Play 링크 referrer=code%3D123456 으로 보냄 → 첫 실행 Install Referrer 1회
// 번호 값은 분석 이벤트·로그에 넣지 않는다(inviteAnalyticsEvent 는 출처만).
// 스파이크: docs/team/spikes/2026-11-17-install-referrer-applinks.md

export type InviteSource = 'app_link' | 'install_referrer';
export type PendingInvite = {code: string; source: InviteSource};

// 초대 번호 유효 기간(서버 0018 규칙: 7일). 그보다 오래된 Play 클릭이면 채우지 않는다(서버도 어차피 거절)
export const INVITE_TTL_SEC = 7 * 24 * 60 * 60;

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

// https://<host>/c#123456 (끝 슬래시 허용). allowedHost 를 주면 그 호스트만.
// /c 안내 페이지의 intent:// 버튼은 조각을 실을 수 없어(#Intent; 가 차지) https://<host>/c?code=123456 으로 들어온다.
// intent:// 는 브라우저 안에서 앱으로 바로 넘어가므로 이 쿼리는 서버에 요청되지 않는다. 조각이 있으면 조각이 우선.
// Android 는 매니페스트 host 와 맞는 URL 만 앱에 주므로 기본은 호스트를 따지지 않는다.
export function codeFromInviteLink(url: unknown, allowedHost?: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }
  const m = /^https:\/\/([^/?#:]+)(?::\d+)?\/c\/?(?:\?([^#]*))?(?:#(.*))?$/i.exec(url.trim());
  if (!m) {
    return null;
  }
  if (allowedHost && m[1].toLowerCase() !== allowedHost.toLowerCase()) {
    return null;
  }
  if (m[3] !== undefined && m[3] !== '') {
    const frag = safeDecode(m[3]);
    return frag === null ? null : normalizeInviteCode(frag);
  }
  return m[2] ? normalizeInviteCode(queryParam(m[2], 'code')) : null;
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

// ---- 앱 상태: 어르신 첫 화면 "가족이 보낸 번호가 있어요" 띠에 쓸 값 ----
// 자동 연결 금지(DECISIONS 11-17): 이 값은 P1c 확인 화면에 "미리 채울" 번호일 뿐, 연결은 사용자가 누른다.
export type InviteState = {pending: PendingInvite | null};
export const INITIAL_INVITE_STATE: InviteState = {pending: null};

export type InviteEvent =
  | {type: 'received'; invite: PendingInvite}
  | {type: 'consumed'}; // 연결에 썼거나 "다른 번호 쓰기"로 치웠다

export function inviteReducer(state: InviteState, ev: InviteEvent): InviteState {
  switch (ev.type) {
    case 'received': {
      const cur = state.pending;
      // 이미 링크로 받은 번호가 있으면 설치 경로 번호(더 오래된 클릭)로 덮지 않는다. 새 링크는 덮는다(사용자가 방금 누름)
      if (cur && cur.source === 'app_link' && ev.invite.source === 'install_referrer') {
        return state;
      }
      if (cur && cur.code === ev.invite.code && cur.source === ev.invite.source) {
        return state;
      }
      return {pending: ev.invite};
    }
    case 'consumed':
      return state.pending ? {pending: null} : state;
  }
}

// 첫 화면 띠: 보일지 + P1c 로 넘길 번호. 문구는 copy 에서(여기는 값만)
export function familyCodeBanner(state: InviteState): {visible: boolean; code: string | null} {
  return state.pending ? {visible: true, code: state.pending.code} : {visible: false, code: null};
}

// 분석 이벤트: 번호 값은 절대 넣지 않는다. 출처만
export function inviteAnalyticsEvent(invite: PendingInvite): {
  name: 'invite_code_prefilled';
  params: {source: InviteSource};
} {
  return {name: 'invite_code_prefilled', params: {source: invite.source}};
}
