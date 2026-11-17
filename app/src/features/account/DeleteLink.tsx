import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color} from '../../ui/tokens';

// 눈에 띄지 않는 작은 링크(터치 영역은 크기 규칙 유지)
export function DeleteLink({onPress, minHeight, label}: {onPress: () => void; minHeight: number; label: string}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.link, {minHeight}]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  link: {alignItems: 'center', justifyContent: 'center', marginTop: 24},
  text: {fontSize: 20, color: color.inkSub, textDecorationLine: 'underline'},
});
