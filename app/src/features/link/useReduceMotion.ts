import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

export type MotionMode = 'full' | 'reduce' | 'none';

// 첫 화면 모션 방식: 스크린리더가 켜져 있으면 'none'(끝 상태로 바로, 포커스가 투명한 요소에 가지 않게),
// 시스템 "동작 줄이기"면 'reduce'(300ms 페이드만), 아니면 'full'. 확인 전에는 null(그동안 시작하지 않음).
export function useMotionMode(): MotionMode | null {
  const [mode, setMode] = useState<MotionMode | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]).then(([reader, reduce]) => {
      if (alive) {
        setMode(reader ? 'none' : reduce ? 'reduce' : 'full');
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}
