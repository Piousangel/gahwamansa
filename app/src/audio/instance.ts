// 기본 오디오 인스턴스(앱 전체 하나: 말하는 중 상태·소리 장치를 공유).
// 앱 생명주기: 처음 만들 때 bindAppLifecycle 로 '앱이 뒤로 가면 모두 멈춤'을 건다(리뷰 M1).
import {AppState} from 'react-native';
import {createAudio, type Audio, type Unsubscribe} from './audioCore';
import {createClipPlayer, createTtsEngine, loadSfx} from './engines';
import {lookupClip} from './voiceClips';

/** 앱이 뒤로 가거나(background) 잠깐 가려지면(inactive) 읽기·배경 음악을 멈춘다. 돌아와도 다시 틀지 않는다(useBgm). */
export function bindAppLifecycle(a: Audio): Unsubscribe {
  const sub = AppState.addEventListener('change', s => {
    if (s !== 'active') {
      a.stopAll();
    }
  });
  return () => sub?.remove();
}

let instance: Audio | null = null;
export function audio(): Audio {
  if (!instance) {
    instance = createAudio({tts: createTtsEngine(), clips: createClipPlayer(lookupClip), loadSfx});
    bindAppLifecycle(instance);
  }
  return instance;
}
/** 테스트용: 기본 인스턴스를 바꾼다(null 이면 다음 호출 때 다시 만든다). 생명주기는 걸지 않는다. */
export function setAudioForTest(next: Audio | null) {
  instance = next;
}
