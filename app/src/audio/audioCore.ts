// 공용 오디오 모듈의 상태(AU-03, docs/team/dev-audio-spike.md 5절). 네이티브 라이브러리는 engines.ts 가 감싸 주입한다
// → 이 파일은 React·네이티브를 모르고 단위 테스트로 규칙을 고정한다. 화면은 hooks.ts(useReadAloud·useBgm)를 쓴다.
// 규칙(DECISIONS 11-17·audioPolicy):
// - 읽어 주기: 사용자가 직접 누른 소리라 벨소리 무음·진동에서도 허용, 화면 읽기 켜짐이면 막음(readAloudAllowed 한 곳).
//   새로 읽기 전에 이전 읽기를 멈춘다(겹쳐 읽지 않음).
// - 미리 생성 음성(DECISIONS 11-19): 글을 문장으로 나눠 **모든 문장**에 파일이 있으면 파일을 차례로 재생한다(한국어 기기 음성 불필요).
//   하나라도 없으면 글 전체를 기기 TTS 로(한 글 안에서 목소리가 바뀌지 않게). 재생 중 파일이 실패하면 남은 문장을 기기 TTS 로 잇는다.
// - 효과음: 판단은 lib/audioPolicy sfxAllowed 한 곳. 여기는 이름별 소리 장치를 한 번만 열어 같이 쓰게(sfx)만 한다.
// - 배경 음악: 읽어 주는 동안 5%(BGM_DUCK_VOLUME, 앱 안 덕킹). 트랙 열기·해제(release)는 useBgm 이 맡는다.
// - stopAll: 앱이 뒤로 가면(bindAppLifecycle) 읽기·재생 중인 음악을 모두 멈춘다.
import {BGM_DUCK_VOLUME, readAloudAllowed, type Ringer} from '../lib/audioPolicy';
import {splitSentences} from './readText';

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

/** 미리 생성 음성 재생기(engines.ts 가 react-native-sound 로 구현). */
export type ClipPlayer = {
  /** 문장 → 자산(없으면 null) */
  lookup(sentence: string): number | string | null;
  /** 끝까지 재생하면 true, 못 열거나 실패·멈춤이면 false */
  play(asset: number | string): Promise<boolean>;
  stop(): void;
};

type Deps = {
  tts: TtsEngine | null;
  clips?: ClipPlayer | null;
  loadSfx: (name: SfxName) => SoundHandle | null;
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

  const sfxCache = new Map<SfxName, SoundHandle | null>();
  /** 재생 중인 배경 음악(stopAll 대상) */
  const playing = new Set<{stop(): void}>();

  // 미리 생성 음성 재생 차례 번호: 멈추거나 새로 읽으면 올라가 이전 재생 고리를 끝낸다
  let clipGen = 0;
  const stopClips = () => {
    clipGen += 1;
    try {
      d.clips?.stop();
    } catch {
      // 무시
    }
  };

  /** 문장마다 파일이 다 있으면 자산 목록, 아니면 null */
  const clipPlan = (text: string): {sentences: string[]; assets: (number | string)[]} | null => {
    if (!d.clips) {
      return null;
    }
    const sentences = splitSentences(text);
    if (sentences.length === 0) {
      return null;
    }
    const assets: (number | string)[] = [];
    for (const s of sentences) {
      const a = d.clips.lookup(s);
      if (a === null) {
        return null;
      }
      assets.push(a);
    }
    return {sentences, assets};
  };

  const playClips = async (plan: {sentences: string[]; assets: (number | string)[]}, gen: number) => {
    for (let i = 0; i < plan.assets.length; i++) {
      let ok = false;
      try {
        ok = await d.clips!.play(plan.assets[i]);
      } catch {
        ok = false;
      }
      if (gen !== clipGen) {
        return; // 멈췄거나 새 읽기가 시작됨
      }
      if (!ok) {
        // 남은 문장은 기기 TTS 로(끝남은 TTS 의 onDone 이 알린다)
        try {
          if (d.tts && (await d.tts.hasKorean()) && gen === clipGen) {
            await d.tts.speak(plan.sentences.slice(i).join('\n'));
            return;
          }
        } catch {
          // 아래에서 끝냄
        }
        break;
      }
    }
    if (gen === clipGen) {
      setSpeaking(false);
    }
  };

  const stopSpeaking = async (): Promise<void> => {
    stopClips();
    try {
      await d.tts?.stop();
    } catch {
      // 멈춤 실패는 무시
    }
    setSpeaking(false);
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
      const plan = clipPlan(text);
      if (plan) {
        if (speaking) {
          await stopSpeaking(); // 겹쳐 읽지 않게(이전이 파일이든 기기 TTS 든)
        }
        stopClips();
        const gen = clipGen;
        setSpeaking(true);
        playClips(plan, gen);
        return 'spoken';
      }
      if (!d.tts) {
        return 'unavailable';
      }
      try {
        if (!(await d.tts.hasKorean())) {
          return 'no_korean_voice';
        }
        if (speaking) {
          stopClips();
          await d.tts.stop(); // 겹쳐 읽지 않게(이전 읽기의 끝 이벤트는 아래 setSpeaking(true) 앞에서 처리됨)
        }
        setSpeaking(true); // 시작 이벤트보다 먼저 덕킹(첫 음절이 음악에 묻히지 않게)
        await d.tts.speak(text);
        return 'spoken';
      } catch {
        setSpeaking(false);
        return 'failed';
      }
    },

    stopSpeaking,

    /** 앱이 뒤로 갈 때 등: 읽기와 재생 중인 배경 음악을 모두 멈춘다. */
    async stopAll(): Promise<void> {
      [...playing].forEach(p => p.stop());
      await stopSpeaking();
    },

    /** 이름별 효과음 소리 장치(한 번만 열어 같이 씀). 낼지 말지는 호출부가 sfxAllowed 로 정한다. 못 열면 null. */
    sfx(name: SfxName): SoundHandle | null {
      if (!sfxCache.has(name)) {
        let h: SoundHandle | null = null;
        try {
          h = d.loadSfx(name);
        } catch {
          h = null;
        }
        sfxCache.set(name, h);
      }
      return sfxCache.get(name) ?? null;
    },

    /** 배경 음악 한 곡을 덕킹 규칙과 묶는다. 재생 여부는 useBgm 이 정하고, 트랙 release 도 useBgm 이 한다. */
    bgm(track: SoundHandle) {
      let unsub: Unsubscribe | null = null;
      const volume = () => (speaking ? BGM_DUCK_VOLUME : 1);
      const ctl = {
        play() {
          if (unsub) {
            return;
          }
          track.setLoops(-1);
          track.setVolume(volume());
          track.play();
          const l = () => track.setVolume(volume());
          listeners.add(l);
          playing.add(ctl);
          unsub = () => {
            listeners.delete(l);
            playing.delete(ctl);
          };
        },
        stop() {
          unsub?.();
          unsub = null;
          track.stop();
        },
        isPlaying: () => unsub !== null,
      };
      return ctl;
    },
  };
}

export type Audio = ReturnType<typeof createAudio>;
