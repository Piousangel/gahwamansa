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
      .then(v => alive && v && setReduce(true)) // 기본값과 같으면 다시 그리지 않는다
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduce(!!v));
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

/** 완료감 모션 방식(시안 P7_motion): 'full' = 크기·이동, 'reduce' = 200ms 페이드만(동작 줄이기 또는 화면 읽기).
 *  확인 전에는 null — 그동안 모션을 시작하지 않는다(줄이기 설정인데 첫 프레임에 큰 모션이 보이는 것을 막음). */
export type MotionMode = 'full' | 'reduce';
export function useMotionMode(): MotionMode | null {
  const [mode, setMode] = useState<MotionMode | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).catch(() => false),
      Promise.resolve(AccessibilityInfo.isScreenReaderEnabled()).catch(() => false),
    ]).then(([reduce, reader]) => {
      if (alive) {
        setMode(reduce || reader ? 'reduce' : 'full');
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}
