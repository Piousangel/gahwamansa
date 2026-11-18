// 네이티브 오디오 라이브러리 연결(DECISIONS 11-17 승인 버전, package.json 정확 고정). 라이브러리 교체 시 이 파일만 바뀐다.
// - TTS: @mhpdev/react-native-speech 1.4.4(TurboModule). Android 11+ TTS 엔진 조회 <queries> TTS_SERVICE 는 라이브러리 매니페스트가 병합.
// - 효과음·BGM: react-native-sound 0.13.0. setCategory('Ambient', true): iOS 무음 스위치를 따르고, Android 는 mixWithOthers=true 라
//   오디오 포커스를 잡지 않음(유튜브·라디오를 끊지 않음).
// - 벨소리 모드: react-native-volume-manager 2.2.0 getRingerMode(Android). 읽기에는 방해 금지 권한 불필요.
// 어느 것이든 불러오기·호출이 실패하면 null/unknown → 소리 없이 계속(화면을 막지 않음).
import {Image, Platform} from 'react-native';
import type {Ringer} from '../lib/audioPolicy';
import {ringerFromNative, type SfxName, type SoundHandle, type TtsEngine, type Unsubscribe} from './audioCore';

/**
 * 읽어 주기 말 빠르기(리뷰 M4). 같은 숫자라도 플랫폼마다 뜻이 다르다: Android TextToSpeech 는 1.0 = 보통,
 * iOS AVSpeechUtterance 는 기본 0.5 = 보통. 스파이크 6절 1번 후보(0.9~1.0)의 조금 느린 쪽. 실기기 QA-04 1번에서 확정(가정값).
 */
export const TTS_RATE = {android: 0.9, ios: 0.45} as const;
const ttsOptions = () => ({language: 'ko-KR', rate: Platform.OS === 'ios' ? TTS_RATE.ios : TTS_RATE.android, pitch: 1.0, ducking: true});

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
      Sound.setCategory?.('Ambient', true);
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

export function createTtsEngine(): TtsEngine | null {
  let Speech: {
    getAvailableVoices(lang?: string): Promise<unknown[]>;
    speak(text: string, o: object): Promise<string>;
    stop(): Promise<void>;
    onStart(cb: () => void): {remove(): void};
    onFinish(cb: () => void): {remove(): void};
    onStopped(cb: () => void): {remove(): void};
    onError(cb: () => void): {remove(): void};
  };
  try {
    Speech = require('@mhpdev/react-native-speech').default;
    if (!Speech) {
      return null;
    }
  } catch {
    return null;
  }
  // 있음만 기억한다: 없음이면 매번 다시 물어 사용자가 한국어 음성을 설치하고 돌아온 경우를 잡는다(리뷰 L1)
  let korean = false;
  return {
    async hasKorean() {
      if (!korean) {
        const voices = await Speech.getAvailableVoices('ko');
        korean = Array.isArray(voices) && voices.length > 0;
      }
      return korean;
    },
    speak: async text => {
      await Speech.speak(text, ttsOptions());
    },
    stop: () => Speech.stop(),
    onStart(cb) {
      const s = Speech.onStart(cb);
      return () => s.remove();
    },
    onDone(cb) {
      const subs = [Speech.onFinish(cb), Speech.onStopped(cb), Speech.onError(cb)];
      return () => subs.forEach(s => s.remove());
    },
  };
}
