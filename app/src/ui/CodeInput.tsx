import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {color, FONT_SCALE_MAX, radius, size} from './tokens';
import {CODE_LENGTH, formatCode} from './codeInputLogic';

type Props = {
  value: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onClear: () => void;
  /** 칸·키 높이(기본 size.codeBox). 화면이 남은 높이에 맞춰 64~68 로 정한다. */
  keyHeight?: number;
};

const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

// 명세 §3: 칸 flex·높이 68·반경 16·간격 8·숫자 34, 키 높이 68·반경 22·테두리 3·숫자 34("모두 지움" 20, "지움" 24).
function Key({label, a11y, onPress, textSize = 34, h}: {label: string; a11y: string; onPress: () => void; textSize?: number; h?: number}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({pressed}) => [styles.key, h ? {minHeight: h} : null, pressed ? styles.keyPressed : null]}>
      <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.keyText, {fontSize: textSize}]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CodeInput({value, onDigit, onDelete, onClear, keyHeight}: Props) {
  return (
    <View>
      <View style={styles.cells} accessibilityLabel={`입력한 번호 ${formatCode(value)}`}>
        {Array.from({length: CODE_LENGTH}).map((_, i) => (
          <View key={i} testID={`code-cell-${i}`} style={[styles.cell, keyHeight ? {minHeight: keyHeight} : null, i === Math.min(value.length, CODE_LENGTH - 1) && value.length < CODE_LENGTH ? styles.cellNow : null]}>
            <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.cellText}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      {ROWS.map(r => (
        <View key={r[0]} style={styles.row}>
          {r.map(d => (
            <Key key={d} h={keyHeight} label={d} a11y={`숫자 ${d}`} onPress={() => onDigit(d)} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Key h={keyHeight} label="모두 지움" a11y="전부 지우기" onPress={onClear} textSize={20} />
        <Key h={keyHeight} label="0" a11y="숫자 0" onPress={() => onDigit('0')} />
        <Key h={keyHeight} label="지움" a11y="한 칸 지우기" onPress={onDelete} textSize={24} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  cells: {flexDirection: 'row', gap: 8, marginBottom: 16},
  // 칸 = 채울 자리: 옅은 면 + 굵은 아래 선. 지금 쓸 칸은 굵은 테두리(action, 대비 7.05)와 흰 면으로 강조
  cell: {flex: 1, minHeight: size.codeBox, borderWidth: 0, borderBottomWidth: 4, borderColor: color.line, borderRadius: radius.input, backgroundColor: color.paperSoft, alignItems: 'center', justifyContent: 'center'},
  cellNow: {borderWidth: 4, borderBottomWidth: 4, borderColor: color.action, backgroundColor: color.card},
  cellText: {fontSize: 34, color: color.ink, fontWeight: 'bold'},
  row: {flexDirection: 'row', gap: 8, marginBottom: 8},
  // 키 = 누르는 버튼: 채워진 면(paperEdge, 글자 대비 5.76), 테두리 없음. 눌림은 actionSoft(6.03)
  key: {flex: 1, minHeight: size.codeBox, borderRadius: radius.card, backgroundColor: color.paperEdge, borderWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4},
  keyPressed: {backgroundColor: color.actionSoft},
  keyText: {color: color.ink, fontWeight: 'bold', textAlign: 'center'},
});
