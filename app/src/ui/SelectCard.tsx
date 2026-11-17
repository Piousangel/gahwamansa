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
};

// 명세 §2: minHeight 132, 반경 24, 테두리 4, 패딩 16, 글자 32 / 배지 20 굵게. 선택은 색 + 굵은 테두리 + 글자("골랐어요").
export function SelectCard({label, selected, onPress, state, errorText, selectedLabel = copy.question.chosen}: Props) {
  const s: SelectCardState = state ?? (selected ? 'selected' : 'default');
  const on = selected || s === 'selected';
  const locked = s === 'saving' || s === 'disabled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: on, disabled: locked, busy: s === 'saving'}}
      disabled={locked}
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
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
  on: {backgroundColor: color.actionSoft, borderColor: color.action},
  off: {backgroundColor: color.card, borderColor: color.line},
  pressed: {backgroundColor: color.paperSoft, borderColor: color.action},
  error: {backgroundColor: color.card, borderColor: color.dangerInk},
  disabled: {backgroundColor: color.disabledBg, borderColor: color.disabledBg},
  label: {fontSize: 32, lineHeight: Math.round(32 * lineHeight.title), color: color.ink, fontWeight: 'bold', letterSpacing: 0},
  badge: {fontSize: 20, lineHeight: 30, color: color.actionPressed, fontWeight: 'bold'},
  errorText: {fontSize: 20, lineHeight: 30, color: color.dangerInk, fontWeight: 'bold'},
});
