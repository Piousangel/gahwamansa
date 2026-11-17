import {useEffect, useRef, useState, type RefObject} from 'react';
import {AccessibilityInfo} from 'react-native';

// TalkBack 명세(docs/design/v3/a11y/talkback-spec.md) 공통 규칙 R1~R16 중 공용 컴포넌트가 지키는 것의 도우미.

/** 화면 읽기 포커스를 이 요소로 옮긴다(R2·R12). setAccessibilityFocus 는 0.88에서 폐기 예정이라 이벤트를 쓴다. */
export function focusOn(ref: RefObject<unknown> | undefined) {
  const node = ref?.current;
  if (node) {
    AccessibilityInfo.sendAccessibilityEvent(node as never, 'focus');
  }
}

/** 창이 닫히거나 화면이 바뀐 직후엔 포커스가 튕기므로 300ms 뒤에 옮긴다(R2). */
export const FOCUS_DELAY_MS = 300;

/** R11: 상태 변화는 한 번만 알린다. liveRegion 과 같이 쓰면 두 번 읽혀 이 경로 하나만 쓴다. */
export function announce(text: string) {
  AccessibilityInfo.announceForAccessibility(text);
}

/** R12: visible 이 true→false 로 바뀌면 연 버튼(returnFocusRef)으로 포커스를 돌려준다. */
export function useReturnFocus(visible: boolean, returnFocusRef?: RefObject<unknown>) {
  const was = useRef(visible);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (was.current && !visible && returnFocusRef) {
      t = setTimeout(() => focusOn(returnFocusRef), FOCUS_DELAY_MS);
    }
    was.current = visible;
    return () => (t ? clearTimeout(t) : undefined);
  }, [visible, returnFocusRef]);
}

/** R16: 화면 읽기(TalkBack·VoiceOver)가 켜져 있는지. 확인 전에는 false, 바뀌면 따라간다. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    // 네이티브 모듈이 없을 때(테스트·일부 기기) undefined 를 돌려줘도 죽지 않게 감싼다
    Promise.resolve(AccessibilityInfo.isScreenReaderEnabled())
      .then(v => alive && v && setOn(true))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', v => setOn(!!v));
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return on;
}
