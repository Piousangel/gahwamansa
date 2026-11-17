// 응원 계약(서버 0020: send_cheer · get_my_cheers · mark_cheers_read). 플랫폼 무관 TS만(React·RN·copy import 금지).
// 확정(0020, main 3b76263 · migrations/20261116000020_cheers_rpc.sql · dev-server-notes). 서버가 바뀌면
// 이 파일만 맞춘다(ARCHITECTURE 5절). 앱 types·fakeApi·realApi 는 여기 타입만 쓴다. 통합 테스트: __integration__/cheers.test.ts

/** 서버 send_cheer 화이트리스트와 글자까지 같아야 한다(copy-v3 6절 확정 4개). 순서 = 자녀 화면 목록 순서. */
export const CHEER_KEYS = ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'] as const;
export type CheerKey = (typeof CHEER_KEYS)[number];
export const isCheerKey = (k: string): k is CheerKey => (CHEER_KEYS as readonly string[]).includes(k);

/** get_my_cheers() → jsonb. 안 읽은 것만, 최신순 최대 20개. 보낸 자녀는 밝히지 않는다. */
export type MyCheers = {
  unread_count: number;
  cheers: {id: string; message_key: string; sent_at: string}[];
};

/** mark_cheers_read(p_ids uuid[] default null) → int(바뀐 개수). null 이면 안 읽은 응원 전부. */
export type MarkCheersReadResult = number;

// 런타임 검증(zod 도입 전 최소판, 계획 12 3-3). 모양이 다르면 null → 호출부가 contract_mismatch 로 다룬다.
export function parseMyCheers(v: unknown): MyCheers | null {
  if (!v || typeof v !== 'object') {
    return null;
  }
  const o = v as Record<string, unknown>;
  if (typeof o.unread_count !== 'number' || !Array.isArray(o.cheers)) {
    return null;
  }
  const ok = o.cheers.every(
    c =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as Record<string, unknown>).id === 'string' &&
      typeof (c as Record<string, unknown>).message_key === 'string' &&
      typeof (c as Record<string, unknown>).sent_at === 'string',
  );
  return ok ? (o as MyCheers) : null;
}

export function parseMarkCheersRead(v: unknown): MarkCheersReadResult | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}
