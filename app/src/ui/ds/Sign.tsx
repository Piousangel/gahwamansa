import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text as RNText, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {useReduceMotion} from '../motion';
import {useAudience} from './audience';
import {ds, fontStyle, roleText, roleMark} from './roles';

/**
 * 팻말(Sign, R-22) — 부모님이 P5 에서 고르신 쪽을 싣는 노랑 판. 낱말(P6)은 싣지 않는다(O-1).
 * 노랑(sign)·signInk·signEdge 는 **이 파일에서만** 쓴다. 다른 화면·컴포넌트가 노랑이 필요하면 Sign 을 쓴다
 * (lint [DS:sign] + __tests__/signYellow 가 이 파일 밖의 노랑을 실패시킨다).
 * - size 'hero'(P7·P3D·C4): 화면 너비, minHeight 120, 끈(24·선 2)·못(지름 8) 위에 매달림, −2° 기울기. 처음 볼 때 3°→−2° 한 번 600ms(동작 줄이기는 정지)
 * - size 'row'(지난 날 목록): minHeight 56, 끈 없음, 기울이지 않음
 * - state 'empty': 흰 면 + 점선(시멘트 1.5) — P3 빈 팻말 자리
 * - 글자: hero 는 손글씨(나눔손글씨 붓, 48dp 이상일 때만) signLabel, row 는 Noto 700 signSmall. 확대 상한은 역할 값
 * - 읽기: 호출부가 준 readLabel('오늘 고르신 쪽, 봄' 등 — ui 는 문구를 모른다). 끈·못은 읽지 않는다
 */
export type SignProps = {
  label: string;
  size: 'hero' | 'row';
  state?: 'empty' | 'filled';
  /** 화면 읽기 이름(copy 에서). 예: 어르신 '오늘 고르신 쪽, {글자}', 자녀 '부모님이 고르신 쪽, {글자}' */
  readLabel: string;
  testID?: string;
  /** row 전용: 놓인 칸의 높이를 채운다(SignPair 두 칸 높이 맞춤 — 옆 칸이 두 줄이어도 팻말이 같이 늘어난다) */
  stretch?: boolean;
};

/** 팻말 판 표지(렌더 검사 R-22 '화면당 1개'가 센다 — testUtils/designRules.signViolations). 화면은 쓰지 않는다 */
export const SIGN_NATIVE_ID = 'ds-sign';

const c = ds.color;
const sg = ds.sign;
const HAND_MIN = sg.handMin;
const TILT_FROM = 3;

export function Sign({label, size, state = 'filled', readLabel, testID = 'sign', stretch = false}: SignProps) {
  const a = useAudience();
  const reduce = useReduceMotion();
  const hero = size === 'hero';
  const role = hero ? 'signLabel' : 'signSmall';
  const r = roleText(role, a);
  // 48dp 이상일 때만 손글씨(R-22). signLabel(52·60)은 늘 넘지만 값이 바뀌어도 규칙이 지켜지게 크기로 판단
  const hand = (r.style.fontSize as number) >= HAND_MIN;
  const face = hand ? {...fontStyle('hand', 400), fontWeight: '400' as const} : {};
  const tilt = useRef(new Animated.Value(hero && !reduce ? TILT_FROM : hero ? sg.hero.tilt : 0)).current;
  useEffect(() => {
    if (!hero || reduce) {
      tilt.setValue(hero ? sg.hero.tilt : 0);
      return;
    }
    Animated.timing(tilt, {toValue: sg.hero.tilt, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
  }, [hero, reduce, tilt]);
  const rotate = tilt.interpolate({inputRange: [-10, 10], outputRange: ['-10deg', '10deg']});
  const empty = state === 'empty';
  const pad = hero ? sg.hero.padding : sg.row.padding;
  return (
    <View testID={`${testID}-wrap`} style={hero ? styles.heroWrap : stretch ? styles.grow : null}>
      {hero ? (
        <View testID={`${testID}-rope`} style={styles.rope} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.nail} />
          <View style={styles.string} />
        </View>
      ) : null}
      <Animated.View
        testID={testID}
        nativeID={SIGN_NATIVE_ID}
        accessible
        accessibilityRole="text"
        accessibilityLabel={readLabel}
        style={[
          styles.board,
          {minHeight: hero ? sg.hero.minHeight : sg.row.minHeight, paddingVertical: pad[0], paddingHorizontal: pad[1] ?? pad[0]},
          empty ? styles.empty : styles.filled,
          !hero && stretch ? styles.grow : null,
          {transform: [{rotate}]},
        ]}>
        {empty ? null : (
          <RNText {...koreanTextProps} {...roleMark(role)} maxFontSizeMultiplier={r.maxFontSizeMultiplier} style={[r.style, face, styles.label]}>
            {keepAllChildren(label)}
          </RNText>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {alignSelf: 'stretch', alignItems: 'center'},
  grow: {flexGrow: 1},
  rope: {alignItems: 'center'},
  nail: {width: sg.rope.nail, height: sg.rope.nail, borderRadius: sg.rope.nail / 2, backgroundColor: c.signEdge},
  string: {width: ds.line.sign, height: sg.rope.string, backgroundColor: c.signEdge},
  board: {alignSelf: 'stretch', borderRadius: sg.radius, alignItems: 'center', justifyContent: 'center'},
  filled: {backgroundColor: c.sign, borderWidth: ds.line.sign, borderColor: c.signEdge},
  empty: {backgroundColor: c.card, borderWidth: ds.line.border, borderColor: c.line, borderStyle: 'dashed'},
  label: {textAlign: 'center', color: c.signInk},
});
