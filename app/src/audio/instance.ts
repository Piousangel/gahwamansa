// 기본 오디오 인스턴스(앱 전체 하나: 말하는 중 상태·소리 캐시를 공유).
import {prefs} from '../lib/prefs';
import {createAudio, type Audio} from './audioCore';
import {createTtsEngine, getRinger, loadSfx} from './engines';

let instance: Audio | null = null;
export function audio(): Audio {
  if (!instance) {
    instance = createAudio({tts: createTtsEngine(), ringer: getRinger, loadSfx, prefs: prefs()});
  }
  return instance;
}
/** 테스트용: 기본 인스턴스를 바꾼다(null 이면 다음 호출 때 다시 만든다). */
export function setAudioForTest(next: Audio | null) {
  instance = next;
}
