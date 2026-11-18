// 미연결 기기의 이번 주 도장(리드 결정 2026-11-17 "미연결 도장 출처").
// - 서버에 기록이 없으므로 코스를 마친 날짜(KST YYYY-MM-DD) 문자열 목록만 기기에 둔다. 고른 답·낱말은 저장하지 않는다.
// - 7일이 지난 날짜는 읽을 때 정리한다. 연결된 뒤에는 서버 값만 쓰고 이 목록은 지운다(서버로 옮기지 않음).
// React·RN 을 모른다(lib 규칙). 저장소는 주입하고, 기본은 AsyncStorage(없거나 실패하면 메모리).

import {defaultStore, memoryStore, type KeyValueStore} from './kvStore';

export {memoryStore};
export type {KeyValueStore};

const KEY = 'local_week_stamps_v1';
const KEEP_DAYS = 7;
const DAY_MS = 86400e3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** KST 기준 오늘 날짜 문자열 */
export const kstDate = (now: Date): string => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

export function createLocalStamps(store: KeyValueStore, now: () => Date = () => new Date()) {
  // 오늘 포함 최근 7일(오늘 - 6일 ~ 오늘)만 남긴다. 미래 날짜·형식이 다른 값은 버린다.
  const prune = (dates: string[]): string[] => {
    const today = Date.parse(`${kstDate(now())}T00:00:00Z`);
    const ok = dates.filter(d => {
      if (typeof d !== 'string' || !DATE_RE.test(d)) {
        return false;
      }
      const diff = (today - Date.parse(`${d}T00:00:00Z`)) / DAY_MS;
      return diff >= 0 && diff < KEEP_DAYS;
    });
    return [...new Set(ok)].sort();
  };
  const load = async (): Promise<string[]> => {
    try {
      const raw = await store.getItem(KEY);
      const v: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return []; // 손상된 값·저장소 오류: 도장은 장식이라 비운 것으로 본다
    }
  };
  const save = async (dates: string[]) => {
    try {
      await store.setItem(KEY, JSON.stringify(dates));
    } catch {
      // 무시(다음에 다시 찍힌다)
    }
  };
  return {
    /** 정리된 이번 주(최근 7일) 완료 날짜. 정리 결과를 다시 저장한다. */
    async read(): Promise<string[]> {
      const raw = await load();
      const kept = prune(raw);
      if (kept.length !== raw.length) {
        await save(kept);
      }
      return kept;
    },
    /** 오늘을 더한다(같은 날 여러 번이어도 한 번). */
    async addToday(): Promise<string[]> {
      const next = prune([...(await load()), kstDate(now())]);
      await save(next);
      return next;
    },
    /** 연결 뒤·모두 지우기·처음으로 때 지운다(서버로 옮기지 않음). 지우기가 실패하면 빈 목록을 덮어써 남지 않게 한다. */
    async clear(): Promise<void> {
      try {
        await store.removeItem(KEY);
      } catch {
        await save([]);
      }
    },
  };
}
export type LocalStamps = ReturnType<typeof createLocalStamps>;

let instance: LocalStamps | null = null;
export function localStamps(): LocalStamps {
  if (!instance) {
    instance = createLocalStamps(defaultStore());
  }
  return instance;
}
/** 테스트용: 기본 인스턴스를 주입한 것으로 바꾼다(null 이면 다음 호출 때 기본으로 다시 만든다). */
export function setLocalStampsForTest(next: LocalStamps | null) {
  instance = next;
}
