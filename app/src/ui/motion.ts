import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

/** 공용 컴포넌트 모션 규칙(README §0-6): 위치 이동 없이 불투명도만, 300ms. "동작 줄이기"면 0(바로). */
export const FADE_MS = 300;
export const fadeMs = (reduceMotion: boolean) => (reduceMotion ? 0 : FADE_MS);

/** 시스템 "동작 줄이기"(Android 애니메이션 삭제, iOS 동작 줄이기). 확인 전에는 false, 설정이 바뀌면 따라간다. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then(v => alive && setReduce(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduce(!!v));
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}
