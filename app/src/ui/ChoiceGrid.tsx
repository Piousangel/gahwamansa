import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text20} from './Text20';
import {color, radius} from './tokens';

export type GridChoice = {value: string; label: string; sub?: string; disabled?: boolean; a11yLabel?: string};

// 자녀 화면 고르기 격자(디자인 판정 감사 M10: 높이 56, 2열 — C1 호칭·C4 호칭 겹침 시트가 같은 모양). 묶음은 라디오 그룹(R9).
// ui 는 문구를 모른다 — 글자·읽기 라벨은 호출부가 넘긴다.
export function ChoiceGrid({choices, selected, onSelect, testID}: {choices: GridChoice[]; selected: string | null; onSelect: (v: string) => void; testID?: string}) {
  return (
    <View testID={testID} accessibilityRole="radiogroup" style={styles.grid}>
      {choices.map(c => {
        const on = selected === c.value;
        return (
          <Pressable
            key={c.value}
            accessibilityRole="radio"
            accessibilityLabel={c.a11yLabel ?? c.label}
            accessibilityState={{checked: on, disabled: !!c.disabled}}
            disabled={c.disabled}
            onPress={() => onSelect(c.value)}
            style={[styles.cell, on ? styles.on : null, c.disabled ? styles.off : null]}>
            <Text20 size={22} weight="bold" style={c.disabled ? styles.offText : styles.text}>{c.label}</Text20>
            {c.sub ? <Text20 style={styles.offText}>{c.sub}</Text20> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const CHOICE_H = 56;

const styles = StyleSheet.create({
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  cell: {
    flexBasis: '48%', flexGrow: 1, minHeight: CHOICE_H, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.childCard, borderWidth: 2, borderColor: color.lineSoft, backgroundColor: color.card,
  },
  on: {borderColor: color.action, borderWidth: 3, backgroundColor: color.actionSoft},
  off: {backgroundColor: color.disabledBg, borderColor: color.disabledBg},
  text: {color: color.inkTitle},
  offText: {color: color.disabledInk},
});
