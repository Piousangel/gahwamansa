// 공용 오디오 모듈의 판단·상태(AU-03, docs/team/dev-audio-spike.md 5절). 네이티브 라이브러리는 engines.ts 가 감싸 주입한다
// → 이 파일은 React·네이티브를 모르고 단위 테스트로 정책을 고정한다. 화면은 speak · stopSpeaking · playSfx · bgm 만 쓴다.
// 정책(DECISIONS 11-17·audioPolicy):
// - 읽어 주기: 사용자가 직접 누른 소리라 벨소리 무음·진동에서도 허용, 화면 읽기 켜짐이면 막음(R16, readAloudAllowed 한 곳).
// - 효과음: 설정 '도장 소리' 켜짐 + 벨소리 보통 + 읽어 주기 중 아님(모르면 조용히).
// - 배경 음악: 읽어 주는 동안 10%(BGM_DUCK_VOLUME, 앱 안 덕킹), 끝나면 원래 크기.
import {BGM_DUCK_VOLUME, readAloudAllowed, type Ringer} from '../lib/audioPolicy';
import type {Prefs} from '../lib/prefs';

export type Unsubscribe = () => void;

/** 내장 TTS 엔진(engines.ts 가 @mhpdev/react-native-speech 로 구현). */
export type TtsEngine = {
  hasKorean(): Promise<boolean>;
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
  onStart(cb: () => void): Unsubscribe;
  /** 끝남·멈춤·오류 모두 */
  onDone(cb: () => void): Unsubscribe;
};

/** 번들 소리 하나(engines.ts 가 react-native-sound 로 구현). */
export type SoundHandle = {
  play(): void;
  stop(): void;
  setVolume(v: number): void;
  /** -1 = 무한 반복 */
  setLoops(n: number): void;
  release(): void;
};

export type SfxName = 'stamp';
export type SpeakResult = 'spoken' | 'blocked' | 'unavailable' | 'no_korean_voice' | 'failed';

type Deps = {
  tts: TtsEngine | null;
  ringer: () => Promise<Ringer>;
  loadSfx: (name: SfxName) => SoundHandle | null;
  prefs: Prefs;
};

/** volume-manager getRingerMode 값(0 무음 · 1 진동 · 2 보통) → Ringer. 모르면 unknown(조용한 쪽). */
export function ringerFromNative(v: unknown): Ringer {
  return v === 0 ? 'silent' : v === 1 ? 'vibrate' : v === 2 ? 'normal' : 'unknown';
}

export function createAudio(d: Deps) {
  let speaking = false;
  const listeners = new Set<(speaking: boolean) => void>();
  const setSpeaking = (v: boolean) => {
    if (speaking === v) {
      return;
    }
    speaking = v;
    listeners.forEach(l => l(v));
  };
  d.tts?.onStart(() => setSpeaking(true));
  d.tts?.onDone(() => setSpeaking(false));

  const sfx = new Map<SfxName, SoundHandle | null>();
  const sound = (name: SfxName) => {
    if (!sfx.has(name)) {
      let h: SoundHandle | null = null;
      try {
        h = d.loadSfx(name);
      } catch {
        h = null;
      }
      sfx.set(name, h);
    }
    return sfx.get(name) ?? null;
  };

  return {
    isSpeaking: () => speaking,
    /** 말하는 중 여부가 바뀔 때(배경 음악 덕킹·화면의 '읽는 중' 표시) */
    subscribe(l: (speaking: boolean) => void): Unsubscribe {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },

    async speak(text: string, o: {screenReader: boolean}): Promise<SpeakResult> {
      if (!readAloudAllowed(o.screenReader)) {
        return 'blocked';
      }
      if (!d.tts) {
        return 'unavailable';
      }
      try {
        if (!(await d.tts.hasKorean())) {
          return 'no_korean_voice';
        }
        setSpeaking(true); // 시작 이벤트보다 먼저 덕킹(첫 음절이 음악에 묻히지 않게)
        await d.tts.speak(text);
        return 'spoken';
      } catch {
        setSpeaking(false);
        return 'failed';
      }
    },

    async stopSpeaking(): Promise<void> {
      try {
        await d.tts?.stop();
      } catch {
        // 멈춤 실패는 무시
      }
      setSpeaking(false);
    },

    /** 효과음. 울렸으면 true. 실패는 화면을 막지 않는다. */
    async playSfx(name: SfxName): Promise<boolean> {
      try {
        if (speaking || !(await d.prefs.sfxEnabled()) || (await d.ringer()) !== 'normal') {
          return false;
        }
        const h = sound(name);
        if (!h) {
          return false;
        }
        h.play();
        return true;
      } catch {
        return false;
      }
    },

    /** 배경 음악 한 곡을 덕킹 규칙과 묶는다. 재생 여부(audioPolicy.bgm)는 호출부(useBgm)가 정한다. */
    bgm(track: SoundHandle) {
      let unsub: Unsubscribe | null = null;
      const volume = () => (speaking ? BGM_DUCK_VOLUME : 1);
      return {
        play() {
          if (unsub) {
            return;
          }
          track.setLoops(-1);
          track.setVolume(volume());
          track.play();
          unsub = (() => {
            const l = () => track.setVolume(volume());
            listeners.add(l);
            return () => {
              listeners.delete(l);
            };
          })();
        },
        stop() {
          unsub?.();
          unsub = null;
          track.stop();
        },
      };
    },
  };
}

export type Audio = ReturnType<typeof createAudio>;
