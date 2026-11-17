import {NativeModules} from 'react-native';

// 시스템 촉각(앱 안 HapticModule, Android performHapticFeedback). 권한 없음, 시스템 '터치 진동' 설정을 따른다.
// iOS 는 빌드 1 Android 우선이라 보류(DECISIONS 11-18). 모듈이 없으면(테스트·iOS) 아무것도 하지 않는다.
type Haptic = {confirm?(): void; keyTap?(): void};
// 모듈은 Android 에만 등록돼 있다(iOS 는 없음 → 아무것도 안 함)
const mod = (): Haptic | undefined => (NativeModules as {HapticModule?: Haptic}).HapticModule;

/** P7 도장이 닿는 순간(CONFIRM 계열) */
export function hapticConfirm() {
  mod()?.confirm?.();
}

/** 번호 키패드 키를 누를 때(KEYBOARD_TAP, UX U9). 소리 없음 */
export function hapticKeyTap() {
  try {
    mod()?.keyTap?.();
  } catch {
    // 촉각 실패는 입력을 막지 않는다
  }
}
