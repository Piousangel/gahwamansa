import {useCallback, useRef} from 'react';
import {Animated} from 'react-native';
import {fadeMs, useReduceMotion} from './motion';

/** 열릴 때 불투명도 0→1(위치 이동 없음). 동작 줄이기면 바로 1. 대화상자·시트 공용. */
export function useFadeIn() {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
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
