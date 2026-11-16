import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color, radius, size} from './tokens';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function BigButton({label, onPress, disabled, variant = 'primary'}: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        {minHeight: primary ? size.buttonPrimary : size.buttonSecondary},
        primary
          ? {backgroundColor: pressed ? color.actionDark : color.action}
          : {backgroundColor: pressed ? color.actionSoft : color.card, borderWidth: 3, borderColor: color.actionDark},
        disabled ? {backgroundColor: color.disabled, borderColor: color.disabled} : null,
      ]}>
      <Text
        style={[
          styles.text,
          {color: disabled ? color.inkSub : primary ? '#FFFFFF' : color.actionDark},
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginVertical: 6},
  text: {fontSize: 26, fontWeight: 'bold'},
});
