import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color} from '../../ui/tokens';
import {copy} from '../../copy/copy';

// 자녀 "지난 답" 화면 하단의 작은 계정 지우기 링크(터치 영역 48, 자녀 기준)
export function DeleteLink({onPress}: {onPress: () => void}) {
  const label = copy.child.delete_link;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  link: {alignItems: 'center', justifyContent: 'center', marginTop: 24, minHeight: 48},
  text: {fontSize: 20, color: color.inkSub, textDecorationLine: 'underline'},
});
