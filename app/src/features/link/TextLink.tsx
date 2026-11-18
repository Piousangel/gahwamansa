import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color, FONT_SCALE_MAX, size} from '../../ui/tokens';
import {Icon, IconName} from '../../ui/assets/icons';

// 하단 고정 영역 안의 보조 링크(주 버튼 위). 글자 20, 터치 높이 48(자녀 화면 기준).
export function TextLink({
  label,
  onPress,
  disabled,
  touch,
  icon,
  pressRef,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  touch?: number; // 터치 높이(기본 48, 어르신 화면 64)
  icon?: IconName;
  pressRef?: React.Ref<React.ComponentRef<typeof Pressable>>; // 돌아왔을 때 포커스를 돌려줄 때(D-10)
}) {
  return (
    <Pressable
      ref={pressRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.link, touch ? {minHeight: touch} : null]}>
      {icon ? <Icon name={icon} size={28} color={color.ink} /> : null}
      <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.text, disabled ? styles.off : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {minHeight: size.childTouchMin, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center'},
  text: {fontSize: 20, color: color.ink, textDecorationLine: 'underline', fontWeight: 'bold'},
  off: {color: color.disabledInk, textDecorationLine: 'none'},
});
