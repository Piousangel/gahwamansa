// 가입 번호 계약(redeem_invite_code·peek_invite_code 0028). 플랫폼 무관 TS만(React·RN·copy 금지).
// 근거: dev-server-notes §2 peek_invite_code. 이유(reason)·호칭 목록은 서버 값과 글자까지 같아야 한다.

export const INVITE_FAIL_REASONS = ['invalid', 'used', 'expired', 'rate_limited', 'busy', 'already_linked', 'not_parent_device'] as const;
export type InviteFailReason = (typeof INVITE_FAIL_REASONS)[number];

// 닫힌 호칭 목록(families.parent_title check, 0012·0019)
export const PARENT_TITLES = ['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'] as const;

// P1c 연결 확인: 번호를 쓰지 않고 누가 보낸 번호인지만. 호칭이 없으면 null(시안 P1c "번호만" 상태)
export type PeekResult =
  | {ok: true; parentTitle: string | null}
  | {ok: false; reason: InviteFailReason; retry_after_sec?: number};

// 런타임 검증(리뷰 M3): 계약 밖 모양·reason 이면 null → 호출부가 일반 서버 오류로 다룬다
export function parsePeekResult(v: unknown): PeekResult | null {
  if (!v || typeof v !== 'object') {
    return null;
  }
  const o = v as Record<string, unknown>;
  if (o.ok === true) {
    const t = o.parent_title;
    if (t === undefined || t === null) {
      return {ok: true, parentTitle: null};
    }
    return typeof t === 'string' && (PARENT_TITLES as readonly string[]).includes(t) ? {ok: true, parentTitle: t} : null;
  }
  if (o.ok === false && (INVITE_FAIL_REASONS as readonly string[]).includes(o.reason as string)) {
    const r: PeekResult = {ok: false, reason: o.reason as InviteFailReason};
    if (typeof o.retry_after_sec === 'number' && o.retry_after_sec >= 0) {
      r.retry_after_sec = o.retry_after_sec;
    }
    return r;
  }
  return null;
}
