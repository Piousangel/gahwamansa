// 기기 안 작은 키-값 저장소(미연결 도장·설정 토글 등). React 를 모른다(lib 규칙).
// 기본은 AsyncStorage(이미 있는 의존성). 네이티브 모듈이 없거나(테스트·일부 환경) 실패하면 이 실행 동안만 메모리.

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: async k => m.get(k) ?? null,
    setItem: async (k, v) => {
      m.set(k, v);
    },
    removeItem: async k => {
      m.delete(k);
    },
  };
}

export function defaultStore(): KeyValueStore {
  const mem = memoryStore();
  let native: KeyValueStore | null | undefined;
  const pick = (): KeyValueStore => {
    if (native === undefined) {
      try {
        native = require('@react-native-async-storage/async-storage').default ?? null;
      } catch {
        native = null;
      }
    }
    return native ?? mem;
  };
  const run = async <T>(f: (s: KeyValueStore) => Promise<T>): Promise<T> => {
    try {
      return await f(pick());
    } catch {
      native = null; // 네이티브가 실패하면 메모리로 바꾼다
      return f(mem);
    }
  };
  return {
    getItem: k => run(s => s.getItem(k)),
    setItem: (k, v) => run(s => s.setItem(k, v)),
    removeItem: k => run(s => s.removeItem(k)),
  };
}
