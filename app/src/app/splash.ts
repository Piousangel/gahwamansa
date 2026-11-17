import {useEffect, useState} from 'react';
import {NativeModules} from 'react-native';

// 스플래시 이어가기(SPL_A, docs/design/v3/splash/NOTES-splash.md).
// 1) 네이티브 스플래시: JS 첫 화면이 그려지면 한 번 걷는다(네이티브 쪽 3초 안전장치는 MainActivity).
// 2) 첫 화면 심볼 이동: 실행당 한 번, 가운데 128 심볼이 첫 화면 워드마크 옆 40 자리로 날아간다.
export type SplashTarget = {x: number; y: number; size: number};

let hidden = false;
let flightDone = false;
let target: SplashTarget | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function hideNativeSplash() {
  if (hidden) {
    return;
  }
  hidden = true;
  (NativeModules as {SplashModule?: {hide(): void}}).SplashModule?.hide();
}

export function flightPending() {
  return !flightDone;
}
export function finishFlight() {
  flightDone = true;
  emit();
}
// 첫 화면이 워드마크 옆 심볼의 창 기준 위치를 알려 준다
export function setSplashTarget(t: SplashTarget) {
  target = t;
  emit();
}

function useSplashStore<T>(read: () => T): T {
  const [v, setV] = useState(read);
  useEffect(() => {
    const l = () => setV(read);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, [read]);
  return v;
}
const readTarget = () => target;
const readLanded = () => flightDone;
export const useSplashTarget = () => useSplashStore(readTarget);
// 날아오는 심볼이 도착했는지(도착 전에는 첫 화면의 진짜 심볼을 숨겨 두 개가 겹쳐 보이지 않게)
export const useSplashLanded = () => useSplashStore(readLanded);

// 테스트용
export function resetSplash() {
  hidden = false;
  flightDone = false;
  target = null;
  emit();
}
