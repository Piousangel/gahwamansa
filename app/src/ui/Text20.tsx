import React from 'react';
import {Platform, Text, TextProps, StyleSheet} from 'react-native';
import {BIG_TITLE_MIN, color, FONT_SCALE_MAX, FONT_SCALE_MAX_BODY, labelLineHeight, lineHeightFor, MIN_BODY_FONT} from './tokens';
import {keepAllChildren, koreanTextProps} from './koreanText';
import {useScreenTitleRef} from './screenTitle';

type Props = TextProps & {
  size?: number;
  weight?: 'normal' | 'bold';
  /** 한 줄 라벨(행 제목·상태): 줄 높이 = 글자 + 8. 기본은 여러 줄 표(lineHeightFor). */
  oneLine?: boolean;
};

// 줄 높이는 tokens 의 표(시안 P3 v4 리듬 규칙): 20→30, 22→32, 24→34, 28→38, 32→44, 36→48, 한 줄 라벨은 글자 + 8

export function Text20({size = MIN_BODY_FONT, weight, oneLine, style, children, ...rest}: Props) {
  const fs = Math.max(MIN_BODY_FONT, size);
  // Android 는 글자에 WJ 가 섞이므로 화면 읽기에는 원문을 준다(글자 단위 탐색에 빈 칸이 끼지 않게).
  const a11yLabel =
    rest.accessibilityLabel ?? (Platform.OS === 'android' && typeof children === 'string' ? children : undefined);
  const titleRef = useScreenTitleRef(rest.accessibilityRole === 'header');
  return (
    <Text
      ref={titleRef}
      {...koreanTextProps}
      maxFontSizeMultiplier={fs >= BIG_TITLE_MIN ? FONT_SCALE_MAX : FONT_SCALE_MAX_BODY}
      {...rest}
      accessibilityLabel={a11yLabel}
      style={[styles.base, rest.accessibilityRole === 'header' ? styles.header : null, {fontSize: fs, lineHeight: oneLine ? labelLineHeight(fs) : lineHeightFor(fs)}, weight ? {fontWeight: weight} : null, style]}>
      {keepAllChildren(children)}
    </Text>
  );
}
// 기본 글자색 = 읽는 글 inkBody(차콜). 갈색(ink/action)은 누를 수 있는 것에만(colorRules ①, 디자인 시스템 패널 r1)
// 머리글(accessibilityRole header)은 v4 title·heading 과 같은 inkTitle
const styles = StyleSheet.create({base: {color: color.inkBody, letterSpacing: 0}, header: {color: color.inkTitle}});
