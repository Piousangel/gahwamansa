import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {brand} from '../../ui/tokens';
import {assetRegistry} from '../../ui/assets/registry';
import {KakaoSymbol} from '../../ui/assets/kakaoSymbol';

// 타사 로그인 버튼(design-system/assets/third-party-login/GUIDELINES.md). 카카오·구글은 같은 높이·같은 폭·비슷한 무게
// (구글 규정: 다른 타사 로그인만큼 눈에 띄게). 높이 60(앱 터치 규칙 56 이상, 카카오 레이블 20 <= 60/3), 반경 둘 다 12, OS 기본 서체.
// 카카오: #FEE500, 공식 심볼 왼쪽 정렬, "카카오 로그인" #000 85%. 구글: Light(흰 면·#747775 1px·#1F1F1F), 공식 G, 패딩 12/10/12.
export const SOCIAL_BUTTON_HEIGHT = 60;
const LABEL = 20;
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
      {kakao ? (
        <KakaoSymbol size={LABEL} />
      ) : (
        <Image testID="google-g" source={assetRegistry['google-g']!} style={styles.g} accessibilityElementsHidden importantForAccessibility="no" />
      )}
      {/* 레이블은 가운데, 로고 폭만큼 오른쪽을 비워 좌우 균형(가로 확장 구간 좌우 동일) */}
      <Text maxFontSizeMultiplier={1.3} style={[styles.text, {color: kakao ? brand.kakaoLabel : brand.googleLabel}]}>
        {label}
      </Text>
      <View style={kakao ? styles.kakaoBalance : styles.gBalance} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: SOCIAL_BUTTON_HEIGHT,
    alignSelf: 'stretch',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  kakao: {backgroundColor: brand.kakaoYellow, paddingLeft: 16, paddingRight: 16},
  google: {backgroundColor: brand.googleSurface, borderWidth: 1, borderColor: brand.googleBorder, paddingLeft: 12, paddingRight: 12},
  off: {opacity: 0.6},
  g: {width: 24, height: 24, marginRight: 10},
  text: {flex: 1, textAlign: 'center', fontSize: LABEL, lineHeight: 24, fontWeight: '500'},
  kakaoBalance: {width: LABEL},
  gBalance: {width: 34},
});
