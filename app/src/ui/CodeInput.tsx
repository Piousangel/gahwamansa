import React, {type RefObject} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {color, FONT_SCALE_MAX, radius, size} from './tokens';
import {CODE_LENGTH, formatCode} from './codeInputLogic';
import {keepAllChildren, koreanTextProps} from './koreanText';

type Props = {
  value: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onClear: () => void;
  /** 칸·키 높이(기본 size.codeBox). 화면이 남은 높이에 맞춰 64~68 로 정한다. */
  keyHeight?: number;
  /** 칸 묶음 읽기 라벨(문구는 호출부가 copy 에서). 없으면 예전 라벨 */
  groupLabel?: string;
  /** 칸 바로 아래 한 줄(안내·확인 중·맞지 않음, 시안 P1_connect_v4) */
  belowCells?: React.ReactNode;
  /** 칸 묶음 요소(맞지 않음 때 접근성 포커스를 옮긴다) */
  groupRef?: RefObject<React.ComponentRef<typeof View> | null>;
  /** 접힘 경계 여백: 이 줄(1~4) 앞에 h 만큼 비운다 */
  foldGap?: {before: number; h: number};
  /** 키 줄(1~4)의 위치(키패드 안 y)·높이 알림 */
  onRowLayout?: (row: number, y: number, h: number) => void;
  /** 칸(과 칸 아래 줄)과 키 사이에 더하는 여백(남는 높이, 최대 24는 화면이 정한다) */
  keysGap?: number;
};

const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

// 디자인 결정(11-19, 키패드 남는 높이): 모든 줄 높이는 같고 키는 64~68 을 넘지 않는다.
//   '모두 지움'은 좁은 화면에서 '모두 / 지움' 두 줄이 되는데, 기본 줄높이면 두 줄이 키(64)보다 커져 마지막 줄만 높아졌다(360×700 실측 80).
//   → 글자 키는 줄높이를 글자 + 2 로 좁히고, 그 키의 줄 수(lines)가 키 안(테두리 2×2 제외)에 들어가는 만큼만 확대한다(최대 FONT_SCALE_MAX).
//   재확인 8 M11: 상한은 키마다 줄 수 기준 — '지움'은 한 줄이라 1.5 까지, '모두 지움'은 좁은 화면에서 두 줄이라 그 기준
const WORD_LINE_EXTRA = 2;
const KEY_BORDER_Y = 4;
export function wordKeyScaleMax(h: number | undefined, textSize = 26, lines: 1 | 2 = 2): number {
  const box = h ?? Math.max(64, size.codeBox);
  return Math.max(1, Math.min(FONT_SCALE_MAX, (box - KEY_BORDER_Y) / (lines * (textSize + WORD_LINE_EXTRA))));
}

// 명세 §3: 칸 flex·높이 68·반경 16·간격 8·숫자 34, 키 높이 68·반경 22·테두리 3·숫자 34. 같은 줄 글자 키는 26(시안 P1_connect_v4, "모두 지움"·"지움").
function Key({label, a11y, onPress, textSize = 34, h, lines = 1}: {label: string; a11y: string; onPress: () => void; textSize?: number; h?: number; /** 글자 키가 꺾이는 줄 수(확대 상한 기준) */ lines?: 1 | 2}) {
  const word = textSize < 34; // '모두 지움'·'지움'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({pressed}) => [styles.key, h ? {minHeight: h} : null, pressed ? styles.keyPressed : null]}>
      {/* 감사 M6·디자인 판정 9절: 어절 단위로만 줄바꿈('모두 / 지움'은 되고 '모두 지 / 움'은 안 됨), 글자 크기는 그대로(26 ≥ 22) */}
      <Text
        testID={`key-${label}`}
        {...koreanTextProps}
        maxFontSizeMultiplier={word ? wordKeyScaleMax(h, textSize, lines) : FONT_SCALE_MAX}
        style={[styles.keyText, {fontSize: textSize}, word ? {lineHeight: textSize + WORD_LINE_EXTRA} : null]}>
        {keepAllChildren(label)}
      </Text>
    </Pressable>
  );
}

export function CodeInput({value, onDigit, onDelete, onClear, keyHeight, groupLabel, belowCells, groupRef, foldGap, onRowLayout, keysGap}: Props) {
  // 접힘 경계 여백(RULES-V4 R-15 '접힘 경계는 줄·요소 경계', 디자인 #54): 첫 화면 끝이 키 줄을 반쯤 가르면 그 줄 앞에 여백을 넣어 줄 전체를 접힘 밖으로 민다
  const gap = (row: number) => (foldGap && foldGap.before === row && foldGap.h > 0 ? <View testID="fold-gap" style={{height: foldGap.h}} /> : null);
  return (
    <View>
      <View ref={groupRef} style={[styles.cells, keyHeight ? styles.cellsFitted : null]} accessible accessibilityLabel={groupLabel ?? `입력한 번호 ${formatCode(value)}`}>
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
      {belowCells ? <View style={styles.below}>{belowCells}</View> : null}
      {keysGap && keysGap > 0 ? <View testID="keys-gap" style={{height: keysGap}} /> : null}
      {ROWS.map((r, i) => (
        <React.Fragment key={r[0]}>
        {gap(i + 1)}
        <View testID={`key-row-${i + 1}`} onLayout={onRowLayout ? e => onRowLayout(i + 1, e.nativeEvent.layout.y, e.nativeEvent.layout.height) : undefined} style={[styles.row, keyHeight ? styles.rowFitted : null]}>
          {r.map(d => (
            <Key key={d} h={keyHeight} label={d} a11y={`숫자 ${d}`} onPress={() => onDigit(d)} />
          ))}
        </View>
        </React.Fragment>
      ))}
      {gap(4)}
      <View testID="key-row-4" onLayout={onRowLayout ? e => onRowLayout(4, e.nativeEvent.layout.y, e.nativeEvent.layout.height) : undefined} style={[styles.row, keyHeight ? styles.rowFitted : null]}>
        <Key h={keyHeight} label="모두 지움" a11y="모두 지움" onPress={onClear} textSize={26} lines={2} />
        <Key h={keyHeight} label="0" a11y="숫자 0" onPress={() => onDigit('0')} />
        <Key h={keyHeight} label="지움" a11y="한 칸 지우기" onPress={onDelete} textSize={26} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  cells: {flexDirection: 'row', gap: 8, marginBottom: 16},
  below: {marginTop: -8, marginBottom: 12},
  // 화면에 맞춰 줄일 때(keyHeight 지정): 칸 높이는 시안 그대로 68, 줄 간격 6(features/link/keypadFit)
  cellFitted: {minHeight: size.codeBox},
  cellsFitted: {marginBottom: 12},
  rowFitted: {marginBottom: 6},
  // 칸 = 채울 자리: 옅은 면 + 굵은 아래 선. 지금 쓸 칸은 굵은 테두리(action, 대비 7.05)와 흰 면으로 강조
  // 시안 P1_connect_v4: 높이 68·반경 12·아래 선 3
  cell: {flex: 1, minHeight: size.codeBox, borderWidth: 0, borderBottomWidth: 3, borderColor: color.line, borderRadius: radius.codeCell, backgroundColor: color.paperSoft, alignItems: 'center', justifyContent: 'center'},
  // 지금 쓸 칸: noticeSoft 면 + 테두리 4(action) + 고정 커서 막대(깜박임 없음)
  cellNow: {borderWidth: 3, borderBottomWidth: 3, borderColor: color.action, backgroundColor: color.noticeSoft},
  cursor: {width: 3, height: 34, backgroundColor: color.ink},
  cellText: {fontSize: 34, color: color.inkBody, fontWeight: 'bold'},
  row: {flexDirection: 'row', gap: 8, marginBottom: 8},
  // 키 = 볼록(누르는 곳): 흰 면 + 테두리 3(line) + 옅은 그림자, 최소 64(DECISIONS 실기기 규칙, QA P1#9). 눌림은 actionSoft
  // 시안 P1_connect_v4: 반경 14·테두리 2(line)
  key: {flex: 1, minHeight: Math.max(64, size.codeBox), borderRadius: radius.keypadKey, backgroundColor: color.card, borderWidth: 2, borderColor: color.line, boxShadow: '0px 2px 0px rgba(116,72,33,0.18)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4},
  keyPressed: {backgroundColor: color.actionSoft, boxShadow: 'none'},
  keyText: {color: color.inkTitle, fontWeight: 'bold', textAlign: 'center'},
});
