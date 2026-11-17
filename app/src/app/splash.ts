import {useEffect, useLayoutEffect, useState} from 'react';
import {NativeModules} from 'react-native';

// 스플래시 이어가기(SPL_A, docs/design/v3/splash/NOTES-splash.md).
// 1) 네이티브 스플래시: JS 첫 화면이 그려지면 한 번 걷는다(네이티브 쪽 3초 안전장치는 MainActivity).
// 2) 첫 화면 심볼 이동: 실행당 한 번, 가운데 128 심볼이 첫 화면 워드마크 옆 40 자리로 날아간다.
export type SplashTarget = {x: number; y: number; size: number};

let hidden = false;
// 시작 대기(boot): 앱이 켜진 뒤 첫 "진짜 화면"이 나올 때까지 어느 경로든(첫 실행·어르신·자녀 세션·오프라인)
// 스플래시와 같은 심볼 대기 화면 하나만 보인다. 첫 로딩 중인 화면은 useBootLoading(true) 로 알린다.
// 대기 중인 화면이 하나도 없는 상태가 잠깐(BOOT_GRACE_MS) 이어지면 시작 대기를 끝낸다(화면 교체 사이 틈은 무시).
export const BOOT_GRACE_MS = 150;
let bootDone = false;
let loaders = 0;
let endTimer: ReturnType<typeof setTimeout> | null = null;
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
export const useBootActive = () => useSplashStore(readBoot);
// 날아오는 심볼이 도착했는지(도착 전에는 첫 화면의 진짜 심볼을 숨겨 두 개가 겹쳐 보이지 않게)
export const useSplashLanded = () => useSplashStore(readLanded);

function scheduleBootEnd() {
  if (bootDone || loaders > 0 || endTimer) {
    return;
  }
  endTimer = setTimeout(() => {
    endTimer = null;
    if (loaders === 0 && !bootDone) {
      bootDone = true;
      emit();
    }
  }, BOOT_GRACE_MS);
}

// 첫 로딩 중인 화면이 부른다(같은 커밋 안에서 등록되도록 layout effect). 시작 대기가 끝난 뒤에는 아무 일도 하지 않는다.
export function useBootLoading(active: boolean) {
  useLayoutEffect(() => {
    if (!active || bootDone) {
      return;
    }
    loaders += 1;
    if (endTimer) {
      clearTimeout(endTimer);
      endTimer = null;
    }
    return () => {
      loaders -= 1;
      scheduleBootEnd();
    };
  }, [active]);
}
// 루트가 처음 그려질 때: 대기 중인 화면이 없으면(바로 첫 화면) 곧 끝낸다
export function kickBoot() {
  scheduleBootEnd();
}
const readBoot = () => !bootDone;
// 시작 대기를 바로 끝낸다(화면 단위 테스트가 대기 화면 없이 시작하도록)
export function finishBoot() {
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  bootDone = true;
  emit();
}

// 테스트용
export function resetSplash() {
  bootDone = false;
  loaders = 0;
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  hidden = false;
  flightDone = false;
  target = null;
  emit();
}
