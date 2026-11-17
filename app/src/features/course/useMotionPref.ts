import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

// 완료감 모션 방식(시안 P7_motion): 'full' = 크기·이동 모션, 'reduce' = 200ms 페이드만(동작 줄이기·화면 읽기).
// 확인 전에는 null — 그동안 모션을 시작하지 않는다(줄이기 설정인데 큰 모션이 잠깐 보이는 것을 막음).
// 기능 간 import 금지(ARCHITECTURE §2)라 link/useReduceMotion 대신 코스 안에 둔다.
export type MotionPref = 'full' | 'reduce';

export function useMotionPref(): MotionPref | null {
  const [mode, setMode] = useState<MotionPref | null>(null);
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
