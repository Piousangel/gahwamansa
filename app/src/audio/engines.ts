// 네이티브 오디오 라이브러리 연결(DECISIONS 11-17 승인 버전, package.json 정확 고정). 라이브러리 교체 시 이 파일만 바뀐다.
// - TTS: @mhpdev/react-native-speech 1.4.4(TurboModule). Android 11+ TTS 엔진 조회 <queries> TTS_SERVICE 는 라이브러리 매니페스트가 병합.
// - 효과음·BGM: react-native-sound 0.13.0. setCategory('Ambient', true): iOS 무음 스위치를 따르고, Android 는 mixWithOthers=true 라
//   오디오 포커스를 잡지 않음(유튜브·라디오를 끊지 않음).
// - 벨소리 모드: react-native-volume-manager 2.2.0 getRingerMode(Android). 읽기에는 방해 금지 권한 불필요.
// 어느 것이든 불러오기·호출이 실패하면 null/unknown → 소리 없이 계속(화면을 막지 않음).
import {Platform} from 'react-native';
import type {Ringer} from '../lib/audioPolicy';
import {ringerFromNative, type SfxName, type SoundHandle, type TtsEngine, type Unsubscribe} from './audioCore';

/** 읽어 주기 말 빠르기·높이(어르신 기준 가정값, 실기기 QA-04 1번에서 확정) */
const TTS_OPTIONS = {language: 'ko-KR', rate: 0.5, pitch: 1.0, ducking: true} as const;

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

/** 벨소리 모드가 바뀔 때(Android). 지원하지 않으면 아무것도 하지 않는다. */
export function subscribeRinger(cb: (r: Ringer) => void): Unsubscribe {
  try {
    const vm = require('react-native-volume-manager');
    const sub = vm.addRingerListener?.(() => {
      getRinger().then(cb, () => cb('unknown'));
    });
    return () => {
      try {
        vm.removeRingerListener?.(sub);
      } catch {
        // 무시
      }
    };
  } catch {
    return () => {};
  }
}

let categorySet = false;
/** 번들 소리(require 한 자산 번호 또는 res/raw 이름)를 연다. 로드 실패면 재생해도 조용하다. */
export function loadSound(asset: number | string): SoundHandle | null {
  try {
    const Sound = require('react-native-sound').default ?? require('react-native-sound');
    if (!categorySet) {
      Sound.setCategory?.('Ambient', true);
      categorySet = true;
    }
    let ok = true;
    const s = new Sound(asset, typeof asset === 'string' ? Sound.MAIN_BUNDLE : undefined, (e: unknown) => {
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
  let korean: boolean | null = null;
  return {
    async hasKorean() {
      if (korean === null) {
        const voices = await Speech.getAvailableVoices('ko');
        korean = Array.isArray(voices) && voices.length > 0;
      }
      return korean;
    },
    speak: async text => {
      await Speech.speak(text, TTS_OPTIONS);
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
