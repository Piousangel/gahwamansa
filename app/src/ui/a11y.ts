import type {RefObject} from 'react';
import {AccessibilityInfo} from 'react-native';

/** 화면 읽기 포커스를 이 요소로 옮긴다(대화상자·시트 제목). setAccessibilityFocus 는 0.88에서 폐기 예정이라 이벤트를 쓴다. */
export function focusOn(ref: RefObject<unknown>) {
  const node = ref.current;
  if (node) {
    AccessibilityInfo.sendAccessibilityEvent(node as never, 'focus');
  }
}

/** 나타날 때 한 번 읽기(배너·토스트). Android liveRegion 은 "바뀔 때"만 확실해 처음 나타날 때는 직접 알린다. */
export function announce(text: string) {
  AccessibilityInfo.announceForAccessibility(text);
}
