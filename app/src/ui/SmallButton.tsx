import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {Text20} from './Text20';
import {color, FONT_SCALE_MAX, radius, size} from './tokens';

// 카드·행 안 보조 버튼(복사하기·알림 켜기 등). 외곽선, 터치 64 이상, 글자 20 굵게.
export function SmallButton({label, onPress, disabled}: {label: string; onPress: () => void; disabled?: boolean}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({pressed}) => [styles.base, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}>
      <Text20 weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={disabled ? styles.textOff : styles.text}>
        {label}
      </Text20>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.touchMin, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: color.action, borderRadius: radius.button, backgroundColor: color.card,
  },
  pressed: {backgroundColor: color.actionSoft},
  disabled: {borderWidth: 0, backgroundColor: color.disabledBg},
  text: {color: color.action},
  textOff: {color: color.disabledInk},
});
