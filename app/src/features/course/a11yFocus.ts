import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, View} from 'react-native';

// 코스 화면(P6·P7·P8) 접근성 훅. 기능 간 import 금지(ARCHITECTURE 2절)라 link/useReduceMotion 을 쓰지 않고 여기 둔다.
// TODO(공용): U0·리팩터 줄이 shared/ 에 같은 훅을 두면 그쪽으로 옮긴다.

// TalkBack 명세 R2·R12: 화면·시트·대화상자가 열리면 300ms 뒤 첫 포커스를 제목으로.
export function useFocusOnOpen(open = true) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const t = setTimeout(() => {
      if (ref.current) {
        AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open]);
  return ref;
}

// 화면 읽기(TalkBack·VoiceOver) 켜짐 여부. 켜고 끄는 변화도 따라간다. 확인 전에는 false.
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(v => alive && setOn(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', v => setOn(!!v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

// 움직임을 바로 끝 상태로 보여야 하는가(동작 줄이기 또는 화면 읽기). 확인 전에는 null(그동안 시작하지 않음).
export function useInstantMotion(): boolean | null {
  const [instant, setInstant] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]).then(([reader, reduce]) => alive && setInstant(!!reader || !!reduce));
    return () => {
      alive = false;
    };
  }, []);
  return instant;
}
