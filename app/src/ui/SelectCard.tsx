import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color, radius} from './tokens';

type Props = {label: string; selected: boolean; onPress: () => void};

export function SelectCard({label, selected, onPress}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[styles.card, selected ? styles.on : styles.off]}>
      <Text style={styles.label}>{label}</Text>
      {selected ? <Text style={styles.badge}>골랐어요</Text> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {minHeight: 132, borderRadius: radius.select, borderWidth: 4, padding: 16, justifyContent: 'center', marginVertical: 8},
  on: {backgroundColor: color.actionSoft, borderColor: color.action},
  off: {backgroundColor: color.card, borderColor: color.line},
  label: {fontSize: 32, color: color.ink, fontWeight: 'bold'},
  badge: {fontSize: 20, color: color.actionDark, marginTop: 4},
});
