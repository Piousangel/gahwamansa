// 이 기기의 작은 설정(서버로 보내지 않음). React 를 모른다(lib 규칙).
// - 효과음(도장 소리) 켜기: 기본 켜짐(시안 P7_motion, DECISIONS 11-17). 설정 P13 토글.
// - P7 '화면을 누르면 바로 넘어가요' 안내를 이미 봤는지(첫 1회만, copy 11-7 #16).
import {defaultStore, type KeyValueStore} from './kvStore';

const SFX = 'pref_sfx_enabled';
const SKIP_HINT = 'pref_p7_skip_hint_seen';
const BGM = 'pref_bgm_enabled'; // 배경 음악(기본 꺼짐, DECISIONS 11-17)
const BGM_OFFERED = 'pref_bgm_offered'; // P7 첫 완료 권유를 이미 보였나(한 번만)
const FIRST_GREETING = 'pref_p3_first_greeting_seen'; // 해님 첫 인사(연결 직후 앨범 첫 화면 1회, DECISIONS 11-17)
const FIRST_DONE_DAY = 'pref_p7_first_done_day'; // 처음 코스를 마친 날(KST YYYY-MM-DD). 첫날 음악 권유 제외(V1)
const ZOOM_OPENED ='pref_p4_zoom_opened'; // B1 크게 보기를 한 번이라도 열었나(첫 안내 끝)
const PHOTO_VISITS = 'pref_p4_visits'; // P4 방문 수(첫 안내는 세 번째 방문까지)
const PHOTO_VISIT_DAY = 'pref_p4_visit_day'; // 마지막으로 센 날(KST YYYY-MM-DD). 같은 날 다시 들어오면 세지 않는다(리뷰 L3)

const ONCE_PREFIX = 'pref_evt_once_'; // + 이벤트 이름
export type OnceEvent = 'app_first_open' | 'child_first_answer_viewed';

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
    bgmEnabled: () => getBool(BGM, false),
    setBgmEnabled: (v: boolean) => setBool(BGM, v),
    bgmOffered: () => getBool(BGM_OFFERED, false),
    markBgmOffered: () => setBool(BGM_OFFERED, true),
    firstGreetingSeen: () => getBool(FIRST_GREETING, false),
    markFirstGreetingSeen: () => setBool(FIRST_GREETING, true),
    /** 모두 지우기·처음 화면으로: 다음에 연결하는 계정이 다시 첫 인사를 받게 지운다(리뷰 L3) */
    resetFirstGreeting: async () => {
      try {
        await store.removeItem(FIRST_GREETING);
      } catch {
        // 무시
      }
    },
    /**
     * 이 기기에서 처음 코스를 마친 날(KST). 없으면 today 로 남기고 today 를 돌려준다(P7 진입 때 부름).
     * V1: 음악 권유는 첫날 빼므로, 돌려받은 날이 오늘이면 권유하지 않는다. 읽기·쓰기 실패면 today(= 권유 안 함, 안전한 쪽)
     */
    noteFirstDoneDay: async (today: string): Promise<string> => {
      try {
        const v = await store.getItem(FIRST_DONE_DAY);
        if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          return v;
        }
        await store.setItem(FIRST_DONE_DAY, today);
      } catch {
        // 무시
      }
      return today;
    },
    /** AC-05 한 번만 보내는 이벤트(이 기기 기준): app_first_open·child_first_answer_viewed. 보낸 뒤 표시 */
    // scope: 계정 가명값(accountTag)을 주면 그 계정 기준 1회(PR #61 리뷰 L2). 없으면 기기 기준 1회
    eventOnceSent: (name: OnceEvent, scope?: string) => getBool(`${ONCE_PREFIX}${name}${scope ? `:${scope}` : ''}`, false),
    markEventOnceSent: (name: OnceEvent, scope?: string) => setBool(`${ONCE_PREFIX}${name}${scope ? `:${scope}` : ''}`, true),
    zoomOpened: () => getBool(ZOOM_OPENED, false),
    markZoomOpened: () => setBool(ZOOM_OPENED, true),
    photoVisits: async (): Promise<number> => {
      try {
        const n = Number(await store.getItem(PHOTO_VISITS));
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      } catch {
        return 0;
      }
    },
    /** P4 진행 모드 진입 때 하루 한 번만 센다(day = KST 날짜). 센 뒤(또는 같은 날이면 그대로)의 방문 수를 돌려준다 */
    countPhotoVisit: async (day: string): Promise<number> => {
      let n = 0;
      try {
        const v = Number(await store.getItem(PHOTO_VISITS));
        n = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
        if ((await store.getItem(PHOTO_VISIT_DAY)) === day) {
          return n;
        }
        n += 1;
        await store.setItem(PHOTO_VISITS, String(n));
        await store.setItem(PHOTO_VISIT_DAY, day);
      } catch {
        // 무시
      }
      return n;
    },
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
