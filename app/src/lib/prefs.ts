// 이 기기의 작은 설정(서버로 보내지 않음). React 를 모른다(lib 규칙).
// - 효과음(도장 소리) 켜기: 기본 켜짐(시안 P7_motion, DECISIONS 11-17). 설정 P13 토글.
// - P7 '화면을 누르면 바로 넘어가요' 안내를 이미 봤는지(첫 1회만, copy 11-7 #16).
import {defaultStore, type KeyValueStore} from './kvStore';

const SFX = 'pref_sfx_enabled';
const SKIP_HINT = 'pref_p7_skip_hint_seen';
const FIRST_GREETING = 'pref_p3_first_greeting_seen'; // 해님 첫 인사(연결 직후 앨범 첫 화면 1회, DECISIONS 11-17)

export function createPrefs(store: KeyValueStore) {
  const getBool = async (key: string, fallback: boolean): Promise<boolean> => {
    try {
      const v = await store.getItem(key);
      return v === 'true' ? true : v === 'false' ? false : fallback;
    } catch {
      return fallback;
    }
  };
  const setBool = async (key: string, v: boolean) => {
    try {
      await store.setItem(key, v ? 'true' : 'false');
    } catch {
      // 무시(다음 실행 때 기본값)
    }
  };
  return {
    sfxEnabled: () => getBool(SFX, true),
    setSfxEnabled: (v: boolean) => setBool(SFX, v),
    skipHintSeen: () => getBool(SKIP_HINT, false),
    markSkipHintSeen: () => setBool(SKIP_HINT, true),
    firstGreetingSeen: () => getBool(FIRST_GREETING, false),
    markFirstGreetingSeen: () => setBool(FIRST_GREETING, true),
  };
}
export type Prefs = ReturnType<typeof createPrefs>;

let instance: Prefs | null = null;
export function prefs(): Prefs {
  if (!instance) {
    instance = createPrefs(defaultStore());
  }
  return instance;
}
/** 테스트용: 기본 인스턴스를 바꾼다(null 이면 다음 호출 때 기본으로 다시 만든다). */
export function setPrefsForTest(next: Prefs | null) {
  instance = next;
}
