import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {color, FONT_SCALE_MAX, FONT_SCALE_MAX_BODY, lineHeight, radius, size} from './tokens';
import {keepAllChildren, koreanTextProps} from './koreanText';
import {copy} from '../copy/copy';

export type SelectCardState = 'default' | 'selected' | 'saving' | 'error' | 'disabled';
type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 없으면 selected 로 정한다(기존 호출 호환). saving·disabled 는 누르기 막음. */
  state?: SelectCardState;
  errorText?: string;
  selectedLabel?: string;
  /** 공간이 모자랄 때(P5 3단계): 높이 132 → 96, '고르셨어요'는 같은 줄 오른쪽. 글자 32 유지 */
  compact?: boolean;
};

// 화면 읽기는 라디오(talkback-spec R9): 묶음은 쓰는 쪽에서 accessibilityRole="radiogroup" 으로 감싼다.
// 명세 §2: minHeight 132, 반경 24, 테두리 4, 패딩 16, 글자 32 / 배지 20 굵게. 선택은 색 + 굵은 테두리 + 글자("고르셨어요").
export function SelectCard({label, selected, onPress, state, errorText, selectedLabel = copy.question.chosen, compact}: Props) {
  const s: SelectCardState = state ?? (selected ? 'selected' : 'default');
  const on = selected || s === 'selected';
  const locked = s === 'saving' || s === 'disabled';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{checked: on, disabled: locked, busy: s === 'saving'}}
      disabled={locked}
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
        compact ? styles.compact : null,
        s === 'disabled'
          ? styles.disabled
          : s === 'error'
            ? styles.error
            : on
              ? styles.on
              : pressed
                ? styles.pressed
                : styles.off,
      ]}>
      <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.label, s === 'disabled' ? {color: color.disabledInk} : null]}>
        {keepAllChildren(label)}
      </Text>
      {on ? (
        <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX_BODY} style={styles.badge}>
          {keepAllChildren(selectedLabel)}
        </Text>
      ) : null}
      {s === 'error' && errorText ? (
        <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX_BODY} style={styles.errorText}>
          {keepAllChildren(errorText)}
        </Text>
      ) : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {marginVertical: 8, minHeight: size.selectCard, borderRadius: radius.select, borderWidth: 4, padding: 16, justifyContent: 'center', gap: 4},
  compact: {minHeight: 96, marginVertical: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12},
  on: {backgroundColor: color.actionSoft, borderColor: color.action},
  off: {backgroundColor: color.card, borderColor: color.line},
  pressed: {backgroundColor: color.paperSoft, borderColor: color.action},
  error: {backgroundColor: color.card, borderColor: color.dangerInk},
  disabled: {backgroundColor: color.disabledBg, borderColor: color.disabledBg},
  // #179 M1: 선택지 글자는 읽는 글(inkTitle) — 파랑 on actionSoft 는 6.85 로 어르신 7:1 미달. 누를 수 있음은 카드 테두리·면이 알린다
  label: {fontSize: 32, lineHeight: Math.round(32 * lineHeight.title), color: color.inkTitle, fontWeight: 'bold', letterSpacing: 0},
  badge: {fontSize: 20, lineHeight: 30, color: color.actionPressed, fontWeight: 'bold'},
  errorText: {fontSize: 20, lineHeight: 30, color: color.dangerInk, fontWeight: 'bold'},
});
