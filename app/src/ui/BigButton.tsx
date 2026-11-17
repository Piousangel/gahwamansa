import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {color, FONT_SCALE_MAX, fontSize, lineHeight, radius, shadow, size} from './tokens';
import {keepAllChildren, koreanTextProps} from './koreanText';
import {Text20} from './Text20';

type Variant = 'primary' | 'secondary' | 'danger';
type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  /** 누르기 막고 "잠시만요"로 바꾼다. */
  loading?: boolean;
  loadingLabel?: string;
  /** 비활성일 때 버튼 아래에 이유를 한 줄로 알린다. */
  disabledReason?: string;
  /** 버튼 아래 설명을 스크린리더가 버튼과 함께 읽도록 */
  accessibilityHint?: string;
};

// 명세 §1: 주 minHeight 72·글자 32, 보조·위험 minHeight 64·글자 26·테두리 3, 반경 36, 고정 height 없음.
// 눌림은 색만 바뀜(움직임·Android 리플 없음). 위험은 색이 아니라 외곽선(비채움)+문구로 주 버튼과 구분한다.
export function BigButton({label, onPress, disabled, variant = 'primary', loading, loadingLabel = '잠시만요', disabledReason, accessibilityHint}: Props) {
  const primary = variant === 'primary';
  const blocked = !!disabled || !!loading;
  const shown = loading ? loadingLabel : label;
  return (
    <View testID="big-button" style={styles.wrap}>
      {disabled && disabledReason ? (
        // TalkBack R8: 이유는 버튼 힌트로 읽으니 이 줄은 중복으로 읽지 않는다
        <Text20 style={styles.reason} importantForAccessibility="no" accessibilityElementsHidden>
          {disabledReason}
        </Text20>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={shown}
        accessibilityHint={disabled && disabledReason ? disabledReason : accessibilityHint}
        accessibilityState={{disabled: blocked, busy: !!loading}}
        disabled={blocked}
        onPress={onPress}
        style={({pressed}) => [
          styles.base,
          primary ? styles.primary : styles.outline,
          primary
            ? {backgroundColor: pressed || loading ? color.actionPressed : color.action, boxShadow: pressed ? shadow.softPressed : shadow.soft}
            : variant === 'danger'
              ? {borderColor: color.dangerInk, backgroundColor: pressed || loading ? color.dangerSoft : color.card}
              : {borderColor: color.action, backgroundColor: pressed ? color.actionSoft : loading ? color.paperSoft : color.card},
          disabled ? styles.disabled : null,
        ]}>
        {({pressed}) => (
          <Text
            {...koreanTextProps}
            maxFontSizeMultiplier={FONT_SCALE_MAX}
            style={[
              styles.text,
              primary ? styles.textPrimary : styles.textOutline,
              {
                color: disabled
                  ? color.disabledInk
                  : primary
                    ? color.onAction
                    : variant === 'danger'
                      ? color.dangerInk
                      : pressed
                        ? color.actionPressed
                        : color.action,
              },
            ]}>
            {keepAllChildren(shown)}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {marginVertical: 6}, // 기존 호출부(gap 없는 View 안)에서 버튼이 붙지 않게: 사이 12(touch.gapMin)
  base: {borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 8, alignSelf: 'stretch'},
  primary: {minHeight: size.buttonPrimary},
  outline: {minHeight: size.buttonSecondary, borderWidth: 3, boxShadow: 'none'},
  // 비활성: 테두리 없음(보조 버튼처럼 보이지 않게, QA P1#12). 대신 버튼 위 이유 줄로 왜 못 누르는지 알린다
  disabled: {backgroundColor: color.disabledBg, borderWidth: 0, boxShadow: 'none'},
  text: {fontWeight: 'bold', textAlign: 'center', letterSpacing: 0},
  textPrimary: {fontSize: fontSize.buttonPrimary, lineHeight: Math.round(fontSize.buttonPrimary * lineHeight.button)},
  textOutline: {fontSize: fontSize.buttonSecondary, lineHeight: Math.round(fontSize.buttonSecondary * lineHeight.button)},
  reason: {textAlign: 'center', marginBottom: 8, color: color.inkSub},
});
