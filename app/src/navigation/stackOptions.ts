// 스택 화면 공통 옵션 한 곳(어르신·자녀 스택). iOS 준비도 감사 2.4(docs/team/qa/2026-11-19-ios-readiness-audit.md):
// iOS 는 스와이프 뒤로(native-stack 기본 켜짐)가 화면이 정한 뒤로 동작(app/BackBar useBackAction)을 우회한다
// — 예: 코스 단계에서 '오늘 코스'로 가야 하는데 직전 단계로 간다. 빌드 2(iOS)에서 여기 한 곳만 바꾼다.
// 지금은 동작을 바꾸지 않는다(리드 11-19): 두 플랫폼 모두 native-stack 기본값 그대로(gestureEnabled 를 넣지 않음).
// TODO(빌드 2 iOS): 화면이 onBack 을 정한 경우 gestureEnabled:false 또는 usePreventRemove 로 같은 동작에 묶기, VoiceOver accessibilityEscape 도
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

/** 스와이프 뒤로 설정(지금은 빈 값 = 기본 동작). iOS 분기는 빌드 2에서 여기만 */
export function backGestureOptions(_os: string = ''): Pick<NativeStackNavigationOptions, 'gestureEnabled'> {
  return {};
}

/** 어르신·자녀 스택이 함께 쓰는 화면 옵션 */
export function stackScreenOptions(os?: string): NativeStackNavigationOptions {
  return {headerShown: false, ...backGestureOptions(os)};
}
