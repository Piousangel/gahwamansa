import React from 'react';
import {StyleSheet, Text as RNText, useWindowDimensions, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {useAudience} from './audience';
import {ds, roleMark, roleText} from './roles';
import {Sign} from './Sign';

/**
 * 두 칸 팻말(SignPair, C-4 '지난 날' 안 1 — D-4 2026-11-24). 그날 두 보기를 **원래 순서(A 왼쪽, B 오른쪽)**로 나란히 둔다.
 * - 고른 칸 = Sign row(노랑 팻말). 안 고른 칸 = 면 없음 + 옅은 선 1.5(lineSoft) + 반경 3 + 보조 글자(sub·muted, 400).
 *   흐리게는 불투명도가 아니라 면·색·굵기로(자녀 글자 4.5:1 유지).
 * - 안 고른 칸 글자 확대 상한 = 팻말 글자(signSmall) 상한 1.5 — sub 기본 2.0 을 쓰면 200%에서 안 고른 쪽이 팻말보다 커진다.
 * - 글자 확대 STACK_SCALE 이상이면 위아래로 쌓는다(A 위, B 아래 — 순서 유지).
 * - 팻말이 여러 개 놓이므로 R-22 '화면당 1개'의 예외(지난 날 목록 카드당 1개) 자리에서만 쓴다.
 * 보기 두 개 중 고른 쪽을 못 찾으면(옛 응답 등) 고른 답 팻말 하나만 그린다.
 */
export type SignPairProps = {
  optionA?: string;
  optionB?: string;
  chosen: string;
  /** 팻말 읽기 이름(호출부 copy). 카드가 한 줄로 읽히면 그 안의 팻말은 따로 읽히지 않는다 */
  readLabel: string;
  testID?: string;
};

/** 이 배율부터 위아래로 쌓는다(360 폭에서 칸 약 140 — 150%면 팻말 글자 30이 칸에 4자 남짓) */
export const SIGN_PAIR_STACK_SCALE = 1.5;

export function SignPair({optionA, optionB, chosen, readLabel, testID = 'sign-pair'}: SignPairProps) {
  const a = useAudience();
  const {fontScale} = useWindowDimensions();
  const side = optionA != null && optionB != null ? (chosen === optionA ? 'a' : chosen === optionB ? 'b' : null) : null;
  if (!side) {
    return <Sign size="row" label={chosen} readLabel={readLabel} />;
  }
  const stack = fontScale >= SIGN_PAIR_STACK_SCALE;
  const other = roleText('sub', a, 'muted');
  const cap = roleText('signSmall', a).maxFontSizeMultiplier;
  const cell = (k: 'a' | 'b', label: string) => (
    <View key={k} testID={`pair-${k}`} style={stack ? null : styles.cell}>
      {side === k ? (
        <Sign size="row" label={label} readLabel={readLabel} stretch />
      ) : (
        <View testID="sign-other" style={styles.other}>
          <RNText {...koreanTextProps} {...roleMark('sub')} maxFontSizeMultiplier={cap} style={[other.style, styles.otherText]}>
            {keepAllChildren(label)}
          </RNText>
        </View>
      )}
    </View>
  );
  return (
    <View testID={testID} style={[styles.pair, stack ? styles.stack : styles.side]}>
      {cell('a', optionA!)}
      {cell('b', optionB!)}
    </View>
  );
}

const pad = ds.sign.row.padding;
const styles = StyleSheet.create({
  pair: {gap: 8, alignItems: 'stretch'},
  side: {flexDirection: 'row'},
  stack: {flexDirection: 'column'},
  cell: {flex: 1, minWidth: 0},
  other: {
    flexGrow: 1, minHeight: ds.sign.row.minHeight, paddingVertical: pad[0], paddingHorizontal: pad[1] ?? pad[0],
    borderWidth: ds.line.border, borderColor: ds.color.lineSoft, borderRadius: ds.sign.radius, alignItems: 'center', justifyContent: 'center',
  },
  otherText: {textAlign: 'center'},
});
