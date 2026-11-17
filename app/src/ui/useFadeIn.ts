import {useCallback, useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {fadeMs, useReduceMotion} from './motion';

/**
 * 열릴 때 불투명도 0→1(위치 이동 없음). 동작 줄이기면 바로 1. 대화상자·시트 공용.
 * 닫히면 0으로 되돌려 다시 열 때 첫 프레임이 1로 번쩍이지 않게 한다(리뷰 L4).
 */
export function useFadeIn(visible: boolean) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      opacity.stopAnimation();
      opacity.setValue(0);
    }
  }, [visible, opacity]);
  const start = useCallback(() => {
    const ms = fadeMs(reduce);
    if (ms === 0) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {toValue: 1, duration: ms, useNativeDriver: true}).start();
  }, [opacity, reduce]);
  return {opacity, start};
}
