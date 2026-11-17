import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import {AccessibilityInfo} from 'react-native';
import {focusLater} from './screenTitle';

// TalkBack 명세(docs/design/v3/a11y/talkback-spec.md) 공통 규칙 중 공용 컴포넌트가 지키는 것의 도우미.
// 포커스 이동 자체는 screenTitle.ts(focusNode·focusLater·FOCUS_DELAY_MS) 한 벌만 쓴다.

/** R11: 상태 변화는 한 번만 알린다. liveRegion 과 같이 쓰면 두 번 읽혀 이 경로 하나만 쓴다. */
export function announce(text: string) {
  AccessibilityInfo.announceForAccessibility(text);
}

/**
 * 대화상자·시트 포커스(R2·R12): onShow 에서 openFocus() → 300ms 뒤 제목으로.
 * visible 이 true→false 가 되면 300ms 뒤 연 버튼(returnFocusRef)으로. 닫힘·언마운트 때 대기 중인 타이머는 정리.
 */
export function useModalFocus(visible: boolean, titleRef: RefObject<unknown>, returnFocusRef?: RefObject<unknown>) {
  const cancelOpen = useRef<(() => void) | null>(null);
  const was = useRef(visible);

  const openFocus = useCallback(() => {
    cancelOpen.current?.();
    cancelOpen.current = focusLater(() => titleRef.current);
  }, [titleRef]);

  useEffect(() => {
    let cancelReturn: (() => void) | undefined;
    if (was.current && !visible) {
      cancelOpen.current?.();
      cancelOpen.current = null;
      if (returnFocusRef) {
        cancelReturn = focusLater(() => returnFocusRef.current);
      }
    }
    was.current = visible;
    return () => cancelReturn?.();
  }, [visible, returnFocusRef]);

  useEffect(() => () => cancelOpen.current?.(), []);
  return openFocus;
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
