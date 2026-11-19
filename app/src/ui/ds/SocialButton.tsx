import React from 'react';
import {Image, Pressable, StyleSheet, Text as RNText, View} from 'react-native';
import {brand} from '../tokens';
import {assetRegistry} from '../assets/registry';
import {KakaoSymbol} from '../assets/kakaoSymbol';
import {koreanTextProps} from '../koreanText';
import {ds, roleText} from './roles';

// 타사 로그인 버튼(v4, ui/ 로 이동한 판). 규정: design-system/assets/third-party-login/GUIDELINES.md.
// 브랜드 예외(R-17 단서, tokens-v4 dock.socialGroup): 색·로고는 각 회사 가이드, 글자 굵기 500(역할 토큰 밖).
// 크기·확대 상한은 자녀 button 역할(18, 1.5)을 따르고 줄바꿈을 허용한다(말줄임 없음). 높이는 minHeight 만.
// apple 은 공식 로고 자산이 아직 없어 빠져 있다(N5 결정: 자산 + 커스텀 버튼, B2).
export type SocialProvider = 'kakao' | 'google';
export type SocialButtonProps = {provider: SocialProvider; label: string; onPress: () => void; disabled?: boolean; testID?: string};

/** 브랜드 버튼 최소 높이(앱 터치 56 이상, 카카오 레이블 20 ≤ 60/3) */
export const SOCIAL_MIN_HEIGHT = 60;
const role = roleText('buttonPrimary', 'child');
/** 글자: 자녀 button 역할 크기·줄높이·상한 + 굵기 500(브랜드 예외) */
const BRAND_LABEL = {
  fontSize: role.style.fontSize as number,
  lineHeight: role.style.lineHeight as number,
  fontWeight: '500' as const,
  scaleCap: role.maxFontSizeMultiplier,
};

export function SocialButton({provider, label, onPress, disabled, testID}: SocialButtonProps) {
  const kakao = provider === 'kakao';
  return (
    <Pressable
      testID={testID ?? `social-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, kakao ? styles.kakao : styles.google, disabled ? styles.off : null]}>
      {kakao ? (
        <KakaoSymbol size={BRAND_LABEL.fontSize} />
      ) : (
        <Image testID="google-g" source={assetRegistry['google-g']!} style={styles.g} accessibilityElementsHidden importantForAccessibility="no" />
      )}
      <RNText
        {...koreanTextProps}
        maxFontSizeMultiplier={BRAND_LABEL.scaleCap}
        style={[styles.text, {color: kakao ? brand.kakaoLabel : brand.googleLabel}]}>
        {label}
      </RNText>
      <View style={kakao ? styles.kakaoBalance : styles.gBalance} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {minHeight: SOCIAL_MIN_HEIGHT, alignSelf: 'stretch', borderRadius: ds.radius.chip, flexDirection: 'row', alignItems: 'center', paddingVertical: 8},
  kakao: {backgroundColor: brand.kakaoYellow, paddingHorizontal: 16},
  google: {backgroundColor: brand.googleSurface, borderWidth: 1, borderColor: brand.googleBorder, paddingHorizontal: 12},
  off: {opacity: 0.6},
  g: {width: 24, height: 24, marginRight: 10},
  text: {flex: 1, textAlign: 'center', fontSize: BRAND_LABEL.fontSize, lineHeight: BRAND_LABEL.lineHeight, fontWeight: BRAND_LABEL.fontWeight},
  kakaoBalance: {width: BRAND_LABEL.fontSize},
  gBalance: {width: 34},
});
