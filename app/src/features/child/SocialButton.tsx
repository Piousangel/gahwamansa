import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {brand, FONT_SCALE_MAX, radius} from '../../ui/tokens';

// 소셜 로그인 버튼(각 회사 버튼 가이드 색). 카카오는 시안 C0 대로 노랑 + 검정 글자.
// 브랜드 로고(카카오 말풍선·구글 G)는 공식 에셋을 받으면 왼쪽에 넣는다(지금은 글자만 — 직접 그리지 않음).
type Props = {kind: 'kakao' | 'google'; label: string; onPress: () => void; disabled?: boolean};

export function SocialButton({kind, label, onPress, disabled}: Props) {
  const kakao = kind === 'kakao';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, kakao ? styles.kakao : styles.google, disabled ? styles.off : null]}>
      <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.text, {color: kakao ? brand.kakaoLabel : brand.googleLabel}]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {minHeight: 72, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginVertical: 6},
  kakao: {backgroundColor: brand.kakaoYellow, borderWidth: 3, borderColor: brand.kakaoYellow},
  google: {backgroundColor: brand.googleSurface, borderWidth: 1, borderColor: brand.googleBorder},
  off: {opacity: 0.6},
  text: {fontSize: 26, fontWeight: 'bold'},
});
