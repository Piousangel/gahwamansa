import React from 'react';
import {Platform, StyleSheet, Text, TextProps} from 'react-native';
import {color, FONT_SCALE_MAX, FONT_SCALE_MAX_BODY, lineHeight, typeScale} from './tokens';
import {keepAllChildren, koreanTextProps} from './koreanText';

type Props = TextProps & {
  size?: number;
  weight?: 'normal' | 'bold';
  /** 제목·버튼 글자: 배율 상한 1.5. 기본은 본문 2.0 */
  scale?: 'body' | 'title' | 'button';
};

/** 자녀 화면 글자(최소 16, README §0). 어르신 화면은 Text20(최소 20)을 쓴다. */
export function ChildText({size = typeScale.child.childBody, weight, scale = 'body', style, children, ...rest}: Props) {
  const fs = Math.max(typeScale.child.min, size);
  const a11yLabel =
    rest.accessibilityLabel ?? (Platform.OS === 'android' && typeof children === 'string' ? children : undefined);
  return (
    <Text
      {...koreanTextProps}
      maxFontSizeMultiplier={scale === 'body' ? FONT_SCALE_MAX_BODY : FONT_SCALE_MAX}
      {...rest}
      accessibilityLabel={a11yLabel}
      style={[
        styles.base,
        {fontSize: fs, lineHeight: Math.round(fs * (scale === 'title' ? lineHeight.title : lineHeight.bodyChild))},
        weight ? {fontWeight: weight} : null,
        style,
      ]}>
      {keepAllChildren(children)}
    </Text>
  );
}
const styles = StyleSheet.create({base: {color: color.inkTitle, letterSpacing: 0}});
