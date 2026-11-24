// 응원 계약(서버 0020: send_cheer · get_my_cheers · mark_cheers_read). 플랫폼 무관 TS만(React·RN·copy import 금지).
// 확정(0020, main 3b76263 · migrations/20261116000020_cheers_rpc.sql · dev-server-notes). 서버가 바뀌면
// 이 파일만 맞춘다(ARCHITECTURE 5절). 앱 types·fakeApi·realApi 는 여기 타입만 쓴다. 통합 테스트: __integration__/cheers.test.ts

/**
 * 응원 키 정본(서버 0060 cheer_key_ok 와 글자까지 같다 — cheersContract.test.ts 가 마이그레이션을 읽어 대조).
 * 이 목록 하나를 events.ts message_key·supabase/ops/load-push-copy.mjs 가 그대로 가져다 쓴다(복사 금지).
 * 기존 4키는 지우지도 문장을 바꾸지도 않는다(이미 보낸 한마디의 뜻 보존). 새 13키 = docs/team/copy/2026-11-24-cheer-expansion.md 3절 − ans_seen(DECISIONS 11-24 D-5).
 * 문장이 달라지면 키를 새로 만든다. 순서는 의미 없음(자녀 시트 순서는 CHILD_SHEET_KEYS).
 */
export const CHEER_KEYS = [
  'love_you', 'warm_day', 'thanks_always', 'peaceful_day',
  'ans_me_too', 'ans_tell_more',
  'old_story', 'photo_memory', 'childhood_story',
  'call_soon', 'visit_soon', 'eat_together',
  'love', 'miss_you', 'thought_of_you',
  'doing_well', 'meal_thought',
] as const;
export type CheerKey = (typeof CHEER_KEYS)[number];
export const isCheerKey = (k: string): k is CheerKey => (CHEER_KEYS as readonly string[]).includes(k);

/** 자녀 시트에 보이는 키(순서 = 화면 순서). 새 시트(숨김 3키·묶음)는 다음 레인 — 그때까지 지금 4개 그대로. */
export const CHILD_SHEET_KEYS = ['love_you', 'warm_day', 'thanks_always', 'peaceful_day'] as const satisfies readonly CheerKey[];

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
