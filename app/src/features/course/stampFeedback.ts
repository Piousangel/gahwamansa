import {hapticConfirm} from '../../ui/haptic';
import {prefs as defaultPrefs, type Prefs} from '../../lib/prefs';
import {sfxAllowed, type Ringer} from '../../lib/audioPolicy';
import {audio} from '../../audio';
import {getRinger} from '../../audio/engines';

// P7 도장 '쾅'이 닿는 순간(180ms)의 소리·촉각(시안 P7_motion "소리·촉각·타임라인").
// - 촉각: 시스템 촉각 1회(짧게, 시스템 진동 설정 따름). 동작 줄이기에서도 유지(움직임이 아님). 단계 체크에는 없음.
// - 소리: 나무 도장 '통' 한 번(250ms 이하, assets/stamp.wav). 설정 효과음 꺼짐·무음/진동 모드·읽어 주기 중이면 안 냄.
//   벨소리 모드를 모르면 조용한 쪽(audioPolicy 와 같은 원칙).

export type SoundPlayer = {playStamp(): void};

/** 효과음 판단은 lib/audioPolicy sfxAllowed 한 곳(오디오 리뷰 M3). 이름은 기존 테스트·호출부 호환용. */
export const stampSoundAllowed = sfxAllowed;

type Deps = {
  player: SoundPlayer | null;
  vibrate: () => void;
  ringer: () => Promise<Ringer>;
  ttsSpeaking: () => boolean;
  prefs: Prefs;
};

// 한 번의 완료 연출에 한 번만 울린다(건너뛰기로 끝 상태가 돼도 다시 울리지 않음).
export function createStampFeedback(d: Deps) {
  let fired = false;
  return {
    async fire(): Promise<{sound: boolean; haptic: boolean}> {
      if (fired) {
        return {sound: false, haptic: false};
      }
      fired = true;
      let haptic = false;
      try {
        d.vibrate();
        haptic = true;
      } catch {
        // 촉각 장치 없음: 무시
      }
      let sound = false;
      try {
        const ok =
          !!d.player &&
          stampSoundAllowed({sfxEnabled: await d.prefs.sfxEnabled(), ringer: await d.ringer(), ttsSpeaking: d.ttsSpeaking()});
        if (ok && d.player) {
          d.player.playStamp();
          sound = true;
        }
      } catch {
        sound = false; // 소리 실패는 화면을 막지 않는다
      }
      return {sound, haptic};
    },
  };
}

// ── 기본 연결 ──
// 소리: 공용 오디오 모듈의 '도장' 소리 장치(앱 전체 하나, react-native-sound 0.13.0 · Ambient + mixWithOthers). 못 열면 null(촉각만).
function defaultPlayer(): SoundPlayer | null {
  const h = audio().sfx('stamp');
  return h ? {playStamp: () => h.play()} : null;
}

// 촉각: Android 는 시스템 촉각(앱 안 작은 네이티브 모듈 HapticModule.confirm = performHapticFeedback CONFIRM,
// API 30 미만은 VIRTUAL_KEY). 권한이 필요 없고 시스템 '터치 진동' 끔 설정을 따른다(리뷰 M5).
// iOS 는 빌드 1 Android 우선이라 보류(DECISIONS 11-18). 모듈이 없으면(테스트·iOS) 아무것도 하지 않는다.
function defaultVibrate() {
  hapticConfirm();
}

// 벨소리 모드: 공용 오디오 모듈(react-native-volume-manager 2.2.0 getRingerMode, iOS 는 normal). 모르면 unknown → 조용한 쪽.
const defaultRinger = getRinger;

let override: (() => ReturnType<typeof createStampFeedback>) | null = null;
export function newStampFeedback() {
  if (override) {
    return override();
  }
  return createStampFeedback({
    player: defaultPlayer(),
    vibrate: defaultVibrate,
    ringer: defaultRinger,
    ttsSpeaking: () => audio().isSpeaking(),
    prefs: defaultPrefs(),
  });
}
/** 테스트용: 새 피드백을 만드는 함수를 바꾼다(null 이면 기본). */
export function setStampFeedbackForTest(f: (() => ReturnType<typeof createStampFeedback>) | null) {
  override = f;
}
