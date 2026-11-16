import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {color, radius} from './tokens';
import {CODE_LENGTH, formatCode} from './codeInputLogic';

type Props = {
  value: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onClear: () => void;
};

const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

function Key({label, a11y, onPress}: {label: string; a11y: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={styles.key}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

export function CodeInput({value, onDigit, onDelete, onClear}: Props) {
  return (
    <View>
      <View style={styles.cells} accessibilityLabel={`입력한 번호 ${formatCode(value)}`}>
        {Array.from({length: CODE_LENGTH}).map((_, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.cellText}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      {ROWS.map(r => (
        <View key={r[0]} style={styles.row}>
          {r.map(d => (
            <Key key={d} label={d} a11y={`숫자 ${d}`} onPress={() => onDigit(d)} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Key label="모두 지움" a11y="전부 지우기" onPress={onClear} />
        <Key label="0" a11y="숫자 0" onPress={() => onDigit('0')} />
        <Key label="지움" a11y="한 칸 지우기" onPress={onDelete} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  cells: {flexDirection: 'row', justifyContent: 'center', marginBottom: 12},
  cell: {width: 48, height: 64, borderWidth: 3, borderColor: color.line, borderRadius: radius.chip, backgroundColor: color.card, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center'},
  cellText: {fontSize: 32, color: color.ink, fontWeight: 'bold'},
  row: {flexDirection: 'row', justifyContent: 'center'},
  key: {minWidth: 96, minHeight: 64, margin: 4, borderRadius: radius.card, backgroundColor: color.card, borderWidth: 2, borderColor: color.line, alignItems: 'center', justifyContent: 'center'},
  keyText: {fontSize: 24, color: color.ink, fontWeight: 'bold'},
});
