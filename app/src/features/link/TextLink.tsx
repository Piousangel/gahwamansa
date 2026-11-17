import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color, FONT_SCALE_MAX, size} from '../../ui/tokens';

// 하단 고정 영역 안의 보조 링크(주 버튼 위). 글자 20, 터치 높이 48(자녀 화면 기준).
export function TextLink({label, onPress, disabled}: {label: string; onPress: () => void; disabled?: boolean}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={styles.link}>
      <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.text, disabled ? styles.off : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {minHeight: size.childTouchMin, justifyContent: 'center', alignItems: 'center'},
  text: {fontSize: 20, color: color.ink, textDecorationLine: 'underline', fontWeight: 'bold'},
  off: {color: color.disabledInk, textDecorationLine: 'none'},
});
