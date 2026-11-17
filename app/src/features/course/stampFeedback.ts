import {Platform, Vibration} from 'react-native';
import {prefs as defaultPrefs, type Prefs} from '../../lib/prefs';
import type {Ringer} from '../../lib/audioPolicy';

// P7 도장 '쾅'이 닿는 순간(180ms)의 소리·촉각(시안 P7_motion "소리·촉각·타임라인").
// - 촉각: 시스템 촉각 1회(짧게). 동작 줄이기에서도 유지(움직임이 아님). 단계 체크에는 없음.
// - 소리: 나무 도장 '통' 한 번(250ms 이하, assets/stamp.wav). 설정 효과음 꺼짐·무음/진동 모드·읽어 주기 중이면 안 냄.
//   벨소리 모드를 모르면 조용한 쪽(audioPolicy 와 같은 원칙).

export type SoundPlayer = {playStamp(): void};

export function stampSoundAllowed(i: {sfxEnabled: boolean; ringer: Ringer; ttsSpeaking: boolean}): boolean {
  return i.sfxEnabled && i.ringer === 'normal' && !i.ttsSpeaking;
}

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
// 소리: react-native-sound(0.13.0, DECISIONS 11-17 승인). 아직 설치 전이면 null(소리 없이 촉각만).
// TODO(리드): react-native-sound@0.13.0 설치·네이티브 빌드, iOS 는 setCategory('Ambient')(무음 스위치 따름).
let player: SoundPlayer | null | undefined;
function defaultPlayer(): SoundPlayer | null {
  if (player !== undefined) {
    return player;
  }
  try {
    const Sound = require('react-native-sound');
    Sound.setCategory?.('Ambient', true);
    const file = require('../../ui/assets/stamp.wav');
    const s = new Sound(file, (e: unknown) => {
      if (e) {
        player = null;
      }
    });
    player = {playStamp: () => s.play()};
  } catch {
    player = null;
  }
  return player;
}

// 촉각: Android 는 짧은 진동 20ms(VIBRATE 권한, 정상 권한이라 묻지 않음). iOS 의 Vibration 은 길게(약 0.4초) 울려
// '길게 울리지 않음' 규칙과 어긋나므로 쓰지 않는다. TODO: iOS 햅틱(UIImpactFeedbackGenerator)은 의존성 결정 뒤.
function defaultVibrate() {
  if (Platform.OS === 'android') {
    Vibration.vibrate(20);
  }
}

// 벨소리 모드: iOS 는 Ambient 카테고리가 무음 스위치를 따르므로 normal. Android 는 react-native-volume-manager(승인됨)
// 설치 전이라 알 수 없음 → 조용한 쪽(소리 없음). TODO(리드): volume-manager@2.2.0 설치 뒤 getRingerMode 연결.
const defaultRinger = async (): Promise<Ringer> => (Platform.OS === 'ios' ? 'normal' : 'unknown');

let override: (() => ReturnType<typeof createStampFeedback>) | null = null;
export function newStampFeedback() {
  if (override) {
    return override();
  }
  return createStampFeedback({
    player: defaultPlayer(),
    vibrate: defaultVibrate,
    ringer: defaultRinger,
    ttsSpeaking: () => false, // TODO(읽어주기): TTS 연결 뒤 말하는 중 여부
    prefs: defaultPrefs(),
  });
}
/** 테스트용: 새 피드백을 만드는 함수를 바꾼다(null 이면 기본). */
export function setStampFeedbackForTest(f: (() => ReturnType<typeof createStampFeedback>) | null) {
  override = f;
}
