import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color, FONT_SCALE_MAX, radius} from '../../ui/tokens';
import {keepAllChildren, koreanTextProps} from '../../ui/koreanText';

// 첫 화면 큰 버튼: 제목 + 버튼 안 둘째 줄 설명(어느 버튼의 설명인지 헷갈리지 않게). 높이 88 이상.
// 화면 읽기는 "제목. 설명" 한 번에 읽는다.
type Props = {title: string; sub: string; onPress: () => void; variant?: 'primary' | 'secondary'};

export function TwoLineButton({title, sub, onPress, variant = 'primary'}: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed ? (primary ? styles.primaryPressed : styles.secondaryPressed) : null,
      ]}>
      <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.title, primary ? styles.onPrimary : styles.onSecondary]}>
        {keepAllChildren(title)}
      </Text>
      <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.sub, primary ? styles.onPrimary : styles.onSecondary]}>
        {keepAllChildren(sub)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {minHeight: 88, borderRadius: radius.button, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center', marginVertical: 6},
  primary: {backgroundColor: color.action}, // 그림자 없음(패널 합의)
  primaryPressed: {backgroundColor: color.actionPressed},
  // 보조: 흰 면 + 테두리(시안 대비 #744821/흰 7.80)
  secondary: {backgroundColor: color.card, borderWidth: 3, borderColor: color.action},
  secondaryPressed: {backgroundColor: color.actionSoft},
  title: {fontSize: 28, fontWeight: 'bold'},
  sub: {fontSize: 20, marginTop: 4},
  onPrimary: {color: color.onAction},
  onSecondary: {color: color.ink},
});
