import React from 'react';
import {Platform, Text, TextProps, StyleSheet} from 'react-native';
import {BIG_TITLE_MIN, color, FONT_SCALE_MAX, FONT_SCALE_MAX_BODY, lineHeight, MIN_BODY_FONT} from './tokens';
import {keepAllChildren, koreanTextProps} from './koreanText';

type Props = TextProps & {size?: number; weight?: 'normal' | 'bold'};

// 글자 크기별 줄 간격(tokens-v3 lineHeight): 제목 1.3, 말풍선 1.35, 본문 1.5
const ratioFor = (s: number) => (s >= 28 ? lineHeight.title : s >= 24 ? lineHeight.bubble : lineHeight.bodyElder);

export function Text20({size = MIN_BODY_FONT, weight, style, children, ...rest}: Props) {
  const fs = Math.max(MIN_BODY_FONT, size);
  // Android 는 글자에 WJ 가 섞이므로 화면 읽기에는 원문을 준다(글자 단위 탐색에 빈 칸이 끼지 않게).
  const a11yLabel =
    rest.accessibilityLabel ?? (Platform.OS === 'android' && typeof children === 'string' ? children : undefined);
  return (
    <Text
      {...koreanTextProps}
      maxFontSizeMultiplier={fs >= BIG_TITLE_MIN ? FONT_SCALE_MAX : FONT_SCALE_MAX_BODY}
      {...rest}
      accessibilityLabel={a11yLabel}
      style={[styles.base, {fontSize: fs, lineHeight: Math.round(fs * ratioFor(fs))}, weight ? {fontWeight: weight} : null, style]}>
      {keepAllChildren(children)}
    </Text>
  );
}
const styles = StyleSheet.create({base: {color: color.ink, letterSpacing: 0}});
