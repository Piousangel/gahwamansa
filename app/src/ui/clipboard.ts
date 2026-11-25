import {Platform, TurboModuleRegistry, type TurboModule} from 'react-native';

// 글자 복사. 새 의존성 금지라 RN 코어에 아직 들어 있는 네이티브 Clipboard 모듈(Android ClipboardModule)을 공개 API 로 부른다.
// - 최상위 `Clipboard` 는 꺼낼 때마다 폐기 경고(warnOnce 'clipboard-moved')를 낸다.
// - `react-native/Libraries/...` 깊은 import 는 개발 빌드 babel 이 'Deep imports … are deprecated' 경고를 넣는다
//   → 그 LogBox 알림이 Maestro F5 에서 아래 행을 덮었다(#278, 대기열 51). 그래서 TurboModuleRegistry.get 으로 모듈만 가져온다.
// TODO(의존성): 코어에서 네이티브 모듈이 빠지면 @react-native-clipboard/clipboard 로 교체(리드 승인 필요). 모듈이 없거나 실패하면 false.
interface ClipboardModule extends TurboModule {
  setString(content: string): void;
}

export function copyText(text: string): boolean {
  try {
    const mod = TurboModuleRegistry.get<ClipboardModule>('Clipboard');
    if (!mod) {
      return false;
    }
    mod.setString(text);
    return true;
  } catch {
    return false;
  }
}

// AC-08: Android 13(API 33) 이상은 복사하면 시스템이 화면 아래에 복사 확인을 직접 띄운다 → 앱 토스트는 겹치므로 띄우지 않는다(Android 권장).
// 12 이하는 시스템 표시가 없어 앱 토스트로 알린다.
export function systemShowsCopyNotice(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}
