import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {BrandSymbol} from '../ui/assets/brandSymbol';
import type {MotionMode} from '../features/link/useReduceMotion';
import type {SplashTarget} from './splash';
import {color} from '../ui/tokens';

// 네이티브 스플래시(splash_icon: 288dp 캔버스에 심볼 64상자를 164dp, 상자 중심이 캔버스 중심보다 2dp 위)와 같은 크기·자리
export const SPLASH_SYMBOL = 164;
export const SPLASH_LIFT = 2;
const STD = Easing.bezier(0.4, 0, 0.2, 1);
const SAFETY_MS = 1000; // 목표 위치를 못 받으면 1초 뒤 그냥 걷는다

// 스플래시 심볼을 이어받아(같은 자리·같은 크기) 첫 화면으로 넘긴다.
// full: 워드마크 옆 자리로 translate+scale 450ms / reduce: 300ms 페이드아웃 / none: 바로 걷음.
export function SplashOverlay({
  win,
  target,
  mode,
  onDone,
}: {
  win: {width: number; height: number};
  target: SplashTarget | null;
  mode: MotionMode | null;
  onDone: () => void;
}) {
  const move = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => done.current(), SAFETY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (started.current || mode === null) {
      return;
    }
    if (mode === 'none') {
      started.current = true;
      done.current();
      return;
    }
    if (mode === 'reduce') {
      started.current = true;
      Animated.timing(fade, {toValue: 0, duration: 300, easing: STD, useNativeDriver: true}).start(() => done.current());
      return;
    }
    if (!target) {
      return; // 목표를 기다린다(안전장치가 있음)
    }
    started.current = true;
    Animated.timing(move, {toValue: 1, duration: 450, easing: STD, useNativeDriver: true}).start(() => done.current());
  }, [mode, target, move, fade]);

  const left = (win.width - SPLASH_SYMBOL) / 2;
  const top = (win.height - SPLASH_SYMBOL) / 2 - SPLASH_LIFT;
  const k = target ? target.size / SPLASH_SYMBOL : 1;
  // scale 은 가운데 기준이라 목표 중심으로 옮긴다
  const dx = target ? target.x + target.size / 2 - (left + SPLASH_SYMBOL / 2) : 0;
  const dy = target ? target.y + target.size / 2 - (top + SPLASH_SYMBOL / 2) : 0;
  const lerp = (to: number) => move.interpolate({inputRange: [0, 1], outputRange: [0, to]});
  return (
    <View testID="splash-flight" pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          ...styles.abs,
          left,
          top,
          opacity: fade,
          transform: [{translateX: lerp(dx)}, {translateY: lerp(dy)}, {scale: move.interpolate({inputRange: [0, 1], outputRange: [1, k]})}],
        }}>
        <BrandSymbol size={SPLASH_SYMBOL} />
      </Animated.View>
    </View>
  );
}

// JS 대기 화면(복원 중): 스플래시와 같은 자리·같은 크기의 심볼만. 2초가 넘으면 아래 24에 "잠시만요".
export function SplashHold({win, slowText}: {win: {width: number; height: number}; slowText: React.ReactNode | null}) {
  return (
    <View testID="splash-hold" style={[StyleSheet.absoluteFill, styles.paper]}>
      <View style={[styles.abs, {left: (win.width - SPLASH_SYMBOL) / 2, top: (win.height - SPLASH_SYMBOL) / 2 - SPLASH_LIFT}]}>
        <BrandSymbol size={SPLASH_SYMBOL} />
      </View>
      {slowText ? (
        <View style={[styles.slow, {top: (win.height + SPLASH_SYMBOL) / 2 - SPLASH_LIFT + 24}]}>{slowText}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: {position: 'absolute'},
  paper: {backgroundColor: color.paper},
  slow: {position: 'absolute', left: 16, right: 16, alignItems: 'center'},
});
