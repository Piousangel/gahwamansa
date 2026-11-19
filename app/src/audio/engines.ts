// 네이티브 오디오 라이브러리 연결(DECISIONS 11-17 승인 버전, package.json 정확 고정). 라이브러리 교체 시 이 파일만 바뀐다.
// - TTS: @mhpdev/react-native-speech 1.4.4(TurboModule). Android 11+ TTS 엔진 조회 <queries> TTS_SERVICE 는 라이브러리 매니페스트가 병합.
// - 효과음·BGM: react-native-sound 0.13.0. 카테고리(D-40, 리드 결정 11-19, S25 1회차):
//   Android 'Playback' = STREAM_MUSIC(미디어 볼륨·볼륨 키로 조절). 예전 'Ambient' 는 Android 에서 STREAM_NOTIFICATION 이라 알림 볼륨을 따랐다.
//   iOS 'Ambient' 유지(무음 스위치를 따름). 둘 다 mixWithOthers=true → 오디오 포커스를 잡지 않음(유튜브·라디오를 끊지 않음).
//   Android 무음·진동은 아래 getRinger(벨소리 모드)로 계속 내지 않는다(audioPolicy).
// - TTS: 라이브러리가 TextToSpeech 출력 속성을 바꾸지 않아 기본 미디어 스트림(STREAM_MUSIC). ducking 은 다른 앱 소리를 잠깐 줄이는 포커스 요청만.
// - 벨소리 모드: react-native-volume-manager 2.2.0 getRingerMode(Android). 읽기에는 방해 금지 권한 불필요.
// 어느 것이든 불러오기·호출이 실패하면 null/unknown → 소리 없이 계속(화면을 막지 않음).
import {Image, Platform} from 'react-native';
import type {Ringer} from '../lib/audioPolicy';
import {splitSentences} from './readText';
import {ringerFromNative, type ClipPlayer, type SfxName, type SoundHandle, type TtsEngine, type Unsubscribe} from './audioCore';

/**
 * 읽어 주기 말 빠르기(리뷰 M4). 같은 숫자라도 플랫폼마다 뜻이 다르다: Android TextToSpeech 는 1.0 = 보통,
 * iOS AVSpeechUtterance 는 기본 0.5 = 보통. 스파이크 6절 1번 후보(0.9~1.0)의 조금 느린 쪽. 실기기 QA-04 1번에서 확정(가정값).
 */
export const TTS_RATE = {android: 0.9, ios: 0.45} as const;
const ttsOptions = () => ({language: 'ko-KR', rate: Platform.OS === 'ios' ? TTS_RATE.ios : TTS_RATE.android, pitch: 1.0, ducking: true});

/** react-native-sound 카테고리: Android 미디어 스트림, iOS 무음 스위치를 따르는 Ambient(D-40) */
export const soundCategory = (): 'Playback' | 'Ambient' => (Platform.OS === 'android' ? 'Playback' : 'Ambient');

export async function getRinger(): Promise<Ringer> {
  if (Platform.OS === 'ios') {
    return 'normal'; // Ambient 카테고리가 무음 스위치를 따른다
  }
  try {
    const vm = require('react-native-volume-manager');
    return ringerFromNative(await vm.getRingerMode());
  } catch {
    return 'unknown';
  }
}

/**
 * 미디어(음악) 소리 크기 0~1(react-native-volume-manager getVolume, Android 는 music 스트림). 읽기 전 '소리 0' 안내용(AP-03, 시안 PX_read_aloud).
 * 모르면 null(안내하지 않고 그냥 읽는다).
 */
export async function getMediaVolume(): Promise<number | null> {
  try {
    const vm = require('react-native-volume-manager');
    const r = await vm.getVolume?.();
    const v = typeof r === 'number' ? r : r?.volume;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// 벨소리 구독(리뷰 M6): volume-manager 의 removeRingerListener 는 네이티브 관찰자를 전역으로 끊는다. 그래서 네이티브 구독은
// 하나만 두고 앱 안 구독자를 세어, 마지막 구독자가 떠날 때만 전역 해제한다(native-stack 은 이전 화면을 마운트한 채로 둔다).
const ringerSubscribers = new Set<(r: Ringer) => void>();
let nativeRingerSub: unknown = null;
/** 벨소리 모드가 바뀔 때(Android). 지원하지 않으면 아무것도 하지 않는다. 해제 함수는 여러 번 불러도 한 번만 센다. */
export function subscribeRinger(cb: (r: Ringer) => void): Unsubscribe {
  let vm: {addRingerListener?: (f: () => void) => unknown; removeRingerListener?: (s: unknown) => void};
  try {
    vm = require('react-native-volume-manager');
  } catch {
    return () => {};
  }
  const mine = (r: Ringer) => cb(r);
  ringerSubscribers.add(mine);
  if (ringerSubscribers.size === 1) {
    try {
      nativeRingerSub = vm.addRingerListener?.(() => {
        getRinger().then(
          r => ringerSubscribers.forEach(f => f(r)),
          () => ringerSubscribers.forEach(f => f('unknown')),
        );
      });
    } catch {
      nativeRingerSub = null;
    }
  }
  return () => {
    if (!ringerSubscribers.delete(mine) || ringerSubscribers.size > 0) {
      return;
    }
    try {
      vm.removeRingerListener?.(nativeRingerSub);
    } catch {
      // 무시
    }
    nativeRingerSub = null;
  };
}

let categorySet = false;
/**
 * 번들 소리를 연다(리뷰 H1). react-native-sound 0.13.0 은 파일 이름 문자열만 받는다(숫자면 생성자 첫 줄에서 TypeError).
 * require 한 자산 번호는 Image.resolveAssetSource 로 주소를 풀어 넘긴다: debug = Metro http 주소, release = res/raw 이름
 * (예 src_ui_assets_stamp — 0.13.0 은 상대 이름을 raw 자원으로 찾는다). 문자열은 res/raw 이름 그대로.
 * 두 번째 인자는 반드시 undefined(함수를 넘기면 0.13.0 이 경로 앞에 함수 글자를 붙인다). 못 열면 null.
 */
export function loadSound(asset: number | string): SoundHandle | null {
  try {
    const name = typeof asset === 'number' ? Image.resolveAssetSource(asset)?.uri : asset;
    if (typeof name !== 'string' || name.length === 0) {
      return null;
    }
    const Sound = require('react-native-sound').default ?? require('react-native-sound');
    if (!categorySet) {
      Sound.setCategory?.(soundCategory(), true);
      categorySet = true;
    }
    let ok = true;
    const s = new Sound(name, undefined, (e: unknown) => {
      if (e) {
        ok = false;
      }
    });
    return {
      play: () => ok && s.play(),
      stop: () => s.stop(),
      setVolume: v => s.setVolume(v),
      setLoops: n => s.setNumberOfLoops(n),
      release: () => s.release(),
    };
  } catch {
    return null;
  }
}

/**
 * 미리 생성 음성 재생기(react-native-sound 0.13.0). 한 번에 한 파일: 열기(로드 콜백) → 재생 → 끝 콜백에서 해제.
 * 주소 풀기·카테고리는 loadSound 와 같다(soundCategory: Android 미디어 스트림, 오디오 포커스를 잡지 않음). 멈추면 기다리던 play 는 false.
 */
export function createClipPlayer(lookup: (sentence: string) => number | string | null): ClipPlayer {
  let current: {s: {stop(): void; release(): void}; finish: (ok: boolean) => void} | null = null;
  return {
    lookup,
    play(asset) {
      return new Promise<boolean>(resolve => {
        let settled = false;
        let sound: {play(cb: (ok: boolean) => void): void; stop(): void; release(): void} | null = null;
        const finish = (ok: boolean) => {
          if (settled) {
            return;
          }
          settled = true;
          if (current?.finish === finish) {
            current = null;
          }
          try {
            sound?.release();
          } catch {
            // 무시
          }
          resolve(ok);
        };
        try {
          const name = typeof asset === 'number' ? Image.resolveAssetSource(asset)?.uri : asset;
          if (typeof name !== 'string' || name.length === 0) {
            finish(false);
            return;
          }
          const Sound = require('react-native-sound').default ?? require('react-native-sound');
          if (!categorySet) {
            Sound.setCategory?.(soundCategory(), true);
            categorySet = true;
          }
          // 로드 콜백이 생성자 안에서 바로 불릴 수도 있어(캐시) 생성 뒤에 재생을 건다
          let loaded: boolean | null = null;
          const start = () => {
            if (settled || !sound) {
              return;
            }
            if (!loaded) {
              finish(false);
              return;
            }
            sound.play((ok: boolean) => finish(!!ok));
          };
          sound = new Sound(name, undefined, (e: unknown) => {
            loaded = !e;
            start();
          });
          current = {s: sound!, finish};
          if (loaded !== null) {
            start();
          }
        } catch {
          finish(false);
        }
      });
    },
    stop() {
      const c = current;
      current = null;
      if (c) {
        try {
          c.s.stop();
        } catch {
          // 무시
        }
        c.finish(false);
      }
    },
  };
}

export function loadSfx(name: SfxName): SoundHandle | null {
  switch (name) {
    case 'stamp':
      try {
        return loadSound(require('../ui/assets/stamp.wav'));
      } catch {
        return null;
      }
  }
}

/** 우선 쓰는 TTS 엔진(Android). 없거나 한국어 음성이 없으면 기기 기본 엔진을 그대로 쓴다(DECISIONS 11-19 V13a). */
export const GOOGLE_TTS_ENGINE = 'com.google.android.tts';

type NativeVoice = {identifier?: unknown; name?: unknown; quality?: unknown; language?: unknown};
/** 보이스를 고른 결과: local = 네트워크 아닌 보이스를 지정함, network_only = 한국어 보이스가 네트워크뿐이라 엔진 기본, none = 한국어 보이스 없음 */
export type VoicePick = {voice: string | null; kind: 'local' | 'network_only' | 'none'};

const isNetworkVoice = (v: NativeVoice) =>
  /network/i.test(String(v.identifier)) || (typeof v.name === 'string' && /network/i.test(v.name));

/**
 * 기기 보이스 고르기(DECISIONS 11-19, PR #43 리뷰 L1): 네트워크 보이스(읽는 문장이 엔진 회사 서버로 감)는 **고르지 않는다**.
 * 라이브러리 1.4.4 는 isNetworkConnectionRequired 를 넘기지 않아 이름으로 가린다(Google 엔진 규칙 `…-network`·`…-local`).
 * 순서: 네트워크 아닌 Enhanced → 이름에 local → 네트워크 아닌 아무 한국어 보이스 → 없으면 null(엔진 기본).
 * 한계: null 이면 엔진 기본 보이스로 읽고, 그 보이스가 네트워크인지는 엔진 설정에 달렸다(network_only 로 기록).
 *   그때 나가는 글도 개인정보 없는 고정 콘텐츠·응원 문구뿐이다. 미리 생성 음성이 있는 문장은 기기 TTS 를 아예 쓰지 않는다.
 */
export function pickVoice(voices: unknown): VoicePick {
  const ko = Array.isArray(voices)
    ? (voices as NativeVoice[]).filter(
        v =>
          v &&
          typeof v.identifier === 'string' &&
          v.identifier.length > 0 &&
          (typeof v.language !== 'string' || /^ko/i.test(v.language)),
      )
    : [];
  const ok = ko.filter(v => !isNetworkVoice(v));
  const best = ok.find(v => v.quality === 'Enhanced') ?? ok.find(v => /local/i.test(v.identifier as string)) ?? ok[0];
  if (best) {
    return {voice: best.identifier as string, kind: 'local'};
  }
  return {voice: null, kind: ko.length > 0 ? 'network_only' : 'none'};
}

/** pickVoice 의 보이스 이름만(테스트·호환) */
export const pickLocalVoice = (voices: unknown): string | null => pickVoice(voices).voice;

let lastVoicePick: VoicePick | null = null;
/** 마지막으로 고른 기기 보이스(개발자 메뉴·QA-04 확인용). 아직 고르지 않았으면 null */
export function ttsVoicePick(): VoicePick | null {
  return lastVoicePick;
}

type SpeechModule = {
  getAvailableVoices(lang?: string): Promise<unknown[]>;
  getEngines?(): Promise<{name: string; isDefault?: boolean}[]>;
  setEngine?(name: string): Promise<void>;
  speak(text: string, o: object): Promise<string>;
  stop(): Promise<void>;
  onStart(cb: () => void): {remove(): void};
  onFinish(cb: () => void): {remove(): void};
  onStopped(cb: () => void): {remove(): void};
  onError(cb: () => void): {remove(): void};
};

/**
 * Android: Google 엔진이 있으면 그것으로 바꾼다. 바꾼 뒤 한국어 음성이 없으면 원래 기본 엔진으로 되돌린다.
 * 실패는 모두 무시(기본 엔진으로 계속). iOS 는 엔진이 하나라 하지 않는다.
 */
async function preferGoogleEngine(Speech: SpeechModule): Promise<void> {
  if (Platform.OS !== 'android' || !Speech.getEngines || !Speech.setEngine) {
    return;
  }
  try {
    const engines = await Speech.getEngines();
    if (!Array.isArray(engines) || !engines.some(e => e?.name === GOOGLE_TTS_ENGINE)) {
      return;
    }
    const prev = engines.find(e => e?.isDefault)?.name;
    if (prev === GOOGLE_TTS_ENGINE) {
      return;
    }
    await Speech.setEngine(GOOGLE_TTS_ENGINE);
    const ko = await Speech.getAvailableVoices('ko');
    if ((!Array.isArray(ko) || ko.length === 0) && prev) {
      await Speech.setEngine(prev);
    }
  } catch {
    // 기본 엔진으로 계속
  }
}

/**
 * 기기 TTS(@mhpdev/react-native-speech). 개선(DECISIONS 11-19 V13a, r1/F §2):
 * - 엔진: Google 우선(preferGoogleEngine). 보이스: 네트워크 보이스는 고르지 않음(pickVoice, 한계는 그 주석).
 * - 문장 나눠 읽기: 한 문장씩 넣고, 그 문장이 끝나면(onFinish·onError) 다음 문장을 넣는다 → 문장 사이에 쉼.
 *   네이티브 큐에 한꺼번에 넣지 않는 이유(PR #43 리뷰 L3): 라이브러리 stop 은 엔진이 말하는 중일 때만 큐를 비워서,
 *   문장 사이 몇 ms 틈에 누른 '멈춤'이 무시되고 남은 문장을 계속 읽을 수 있었다. 이제 멈추면 멈춤 표시로 다음 문장을 넣지 않고,
 *   막 넣던 문장이 있으면 넣은 뒤 한 번 더 멈춘다.
 * - '끝남'은 마지막 문장 끝·멈춤·실패에 알린다(중간 문장 끝에 덕킹이 풀리거나 버튼이 기본으로 돌아가지 않게).
 * - 보이스를 넣어 실패하면 보이스 없이(엔진 기본) 다시 읽고, 그 뒤로는 보이스를 쓰지 않는다.
 *   Android 라이브러리는 없는 보이스 이름을 오류 없이 무시하므로 이 경로는 주로 iOS·기타 실패용이다(리뷰 L2).
 * 미리 생성 음성(voiceClips)이 있는 문장은 audioCore 가 파일로 읽어 이 엔진을 거치지 않는다.
 */
export function createTtsEngine(): TtsEngine | null {
  let Speech: SpeechModule;
  try {
    Speech = require('@mhpdev/react-native-speech').default;
    if (!Speech) {
      return null;
    }
  } catch {
    return null;
  }
  let prepared: Promise<void> | null = null;
  const prepare = () => (prepared ??= preferGoogleEngine(Speech));
  // 있음만 기억한다: 없음이면 매번 다시 물어 사용자가 한국어 음성을 설치하고 돌아온 경우를 잡는다(리뷰 L1)
  let korean = false;
  let voice: string | null = null;

  // 아직 넣지 않은 문장. 멈추면 비운다(멈춤 표시 = 빈 큐 + 차례 번호 증가)
  let queue: string[] = [];
  let turn = 0;
  // 지금 네이티브에 넣는 중인 문장(넣기 promise). 멈춤이 이 틈에 오면 넣은 뒤 한 번 더 멈춘다
  let inflight: Promise<void> | null = null;
  const doneListeners = new Set<() => void>();
  const startListeners = new Set<() => void>();
  const fireDone = () => doneListeners.forEach(l => l());

  const speakOne = async (s: string) => {
    const base = ttsOptions();
    if (voice) {
      try {
        await Speech.speak(s, {...base, voice});
        return;
      } catch {
        voice = null; // 이 보이스로는 못 읽음 → 이후 엔진 기본
      }
    }
    await Speech.speak(s, base);
  };
  const put = (s: string): Promise<void> => {
    const p = speakOne(s);
    const mine = p.then(
      () => undefined,
      () => undefined,
    );
    inflight = mine;
    mine.then(() => {
      if (inflight === mine) {
        inflight = null;
      }
    });
    return p;
  };
  // 한 문장이 끝남(또는 오류): 남은 문장이 있으면 다음을 넣고, 없으면 끝
  const next = () => {
    const s = queue.shift();
    if (s === undefined) {
      fireDone();
      return;
    }
    const t = turn;
    put(s).catch(() => {
      if (t === turn) {
        queue = [];
        fireDone();
      }
    });
  };
  try {
    Speech.onStart(() => startListeners.forEach(l => l()));
    Speech.onFinish(next);
    Speech.onError(next);
    Speech.onStopped(() => {
      queue = [];
      fireDone();
    });
  } catch {
    // 이벤트를 못 받으면 끝남을 모른다: stop 으로만 풀린다
  }

  return {
    async hasKorean() {
      if (!korean) {
        await prepare();
        const voices = await Speech.getAvailableVoices('ko');
        korean = Array.isArray(voices) && voices.length > 0;
        const pick = korean ? pickVoice(voices) : {voice: null, kind: 'none' as const};
        voice = pick.voice;
        lastVoicePick = pick;
        if (pick.kind === 'network_only' && __DEV__) {
          console.warn('[tts] 한국어 기기 보이스가 네트워크뿐: 엔진 기본 보이스로 읽음(엔진 설정에 따라 서버 합성)');
        }
      }
      return korean;
    },
    speak: async text => {
      await prepare();
      const parts = splitSentences(text);
      const list = parts.length > 0 ? parts : [text];
      turn += 1;
      queue = list.slice(1);
      try {
        await put(list[0]);
      } catch (e) {
        queue = [];
        throw e; // 첫 문장부터 못 넣었으면 실패
      }
    },
    stop: async () => {
      turn += 1;
      queue = []; // 멈춤 표시: 다음 문장을 넣지 않는다
      const wasPutting = inflight;
      await Speech.stop();
      if (wasPutting) {
        await wasPutting;
        await Speech.stop(); // 멈춤과 겹쳐 막 들어간 문장도 멈춘다
      }
    },
    onStart(cb) {
      startListeners.add(cb);
      return () => {
        startListeners.delete(cb);
      };
    },
    onDone(cb) {
      doneListeners.add(cb);
      return () => {
        doneListeners.delete(cb);
      };
    },
  };
}
