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
  /** 칸 묶음 읽기 라벨(문구는 호출부가 copy 에서). 없으면 예전 라벨 */
  groupLabel?: string;
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

export function CodeInput({value, onDigit, onDelete, onClear, keyHeight, groupLabel}: Props) {
  return (
    <View>
      <View style={[styles.cells, keyHeight ? styles.cellsFitted : null]} accessible accessibilityLabel={groupLabel ?? `입력한 번호 ${formatCode(value)}`}>
        {Array.from({length: CODE_LENGTH}).map((_, i) => (
          <View key={i} testID={`code-cell-${i}`} style={[styles.cell, keyHeight ? styles.cellFitted : null, i === Math.min(value.length, CODE_LENGTH - 1) && value.length < CODE_LENGTH ? styles.cellNow : null]}>
            {i === value.length && value.length < CODE_LENGTH ? (
              <View testID="code-cursor" style={styles.cursor} />
            ) : (
              <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.cellText}>{value[i] ?? ''}</Text>
            )}
          </View>
        ))}
      </View>
      {ROWS.map(r => (
        <View key={r[0]} style={[styles.row, keyHeight ? styles.rowFitted : null]}>
          {r.map(d => (
            <Key key={d} h={keyHeight} label={d} a11y={`숫자 ${d}`} onPress={() => onDigit(d)} />
          ))}
        </View>
      ))}
      <View style={[styles.row, keyHeight ? styles.rowFitted : null]}>
        <Key h={keyHeight} label="모두 지움" a11y="전부 지우기" onPress={onClear} textSize={20} />
        <Key h={keyHeight} label="0" a11y="숫자 0" onPress={() => onDigit('0')} />
        <Key h={keyHeight} label="지움" a11y="한 칸 지우기" onPress={onDelete} textSize={24} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  cells: {flexDirection: 'row', gap: 8, marginBottom: 16},
  // 화면에 맞춰 줄일 때(keyHeight 지정): 칸은 보여 주는 곳이라 52 고정, 줄 간격 6(features/link/keypadFit)
  cellFitted: {minHeight: 52},
  cellsFitted: {marginBottom: 12},
  rowFitted: {marginBottom: 6},
  // 칸 = 채울 자리: 옅은 면 + 굵은 아래 선. 지금 쓸 칸은 굵은 테두리(action, 대비 7.05)와 흰 면으로 강조
  cell: {flex: 1, minHeight: size.codeBox, borderWidth: 0, borderBottomWidth: 4, borderColor: color.line, borderRadius: radius.input, backgroundColor: color.paperSoft, alignItems: 'center', justifyContent: 'center'},
  // 지금 쓸 칸: noticeSoft 면 + 테두리 4(action) + 고정 커서 막대(깜박임 없음)
  cellNow: {borderWidth: 4, borderBottomWidth: 4, borderColor: color.action, backgroundColor: color.noticeSoft},
  cursor: {width: 3, height: 34, backgroundColor: color.ink},
  cellText: {fontSize: 34, color: color.ink, fontWeight: 'bold'},
  row: {flexDirection: 'row', gap: 8, marginBottom: 8},
  // 키 = 볼록(누르는 곳): 흰 면 + 테두리 3(line) + 옅은 그림자, 최소 64(DECISIONS 실기기 규칙, QA P1#9). 눌림은 actionSoft
  key: {flex: 1, minHeight: Math.max(64, size.codeBox), borderRadius: radius.card, backgroundColor: color.card, borderWidth: 3, borderColor: color.line, boxShadow: '0px 2px 0px rgba(116,72,33,0.18)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4},
  keyPressed: {backgroundColor: color.actionSoft, boxShadow: 'none'},
  keyText: {color: color.inkTitle, fontWeight: 'bold', textAlign: 'center'},
});
