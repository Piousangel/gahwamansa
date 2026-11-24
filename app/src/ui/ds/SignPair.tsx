import React, {useState} from 'react';
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
 * - 위아래로 쌓기(A 위, B 아래 — 순서 유지): 글자 배율 SIGN_PAIR_STACK_SCALE 이상이거나, 가장 긴 어절이 칸 한 줄에 안 들어갈 때
 *   (QA-1 #239 L5: 360·1.4, 320·1.3 에서 '차려입기' 같은 4음절 어절이 칸에서 강제로 끊김). 한글 한 글자 폭 ≈ 글자 크기(Noto Sans KR 전각)로 어림한다.
 * - 화면 읽기: 두 칸은 숨긴다. 이 부품을 담는 카드가 한 줄('날짜, 질문, 고른 답 …')로 읽는다(QA-1 M1 — 카드 뒤에 팻말 글자를 또 읽지 않게).
 *   그래서 카드처럼 읽기 이름을 가진 accessible 부모 안에서만 쓴다.
 * - 팻말이 여러 개 놓이므로 R-22 '화면당 1개'의 예외(지난 날 목록 카드당 1개) 자리에서만 쓴다.
 * 고른 쪽을 가를 수 없으면(보기 값 없음·두 보기 글자가 같음·고른 답이 둘 다와 다름) 고른 답 팻말 하나만 그린다.
 */
export type SignPairProps = {
  optionA?: string | null;
  optionB?: string | null;
  chosen: string;
  /** 팻말 판 읽기 이름. 두 칸은 화면 읽기에서 숨기므로 실제로는 카드 이름이 읽힌다 */
  readLabel: string;
  testID?: string;
};

/** 이 배율부터는 늘 위아래로 쌓는다(시안 200% 보드) */
export const SIGN_PAIR_STACK_SCALE = 1.5;
const GAP = 8;
const pad = ds.sign.row.padding;
const PAD_X = pad[1] ?? pad[0];

/** 가장 긴 어절의 글자 수(공백으로 나눔) */
const longestWord = (s: string) => Math.max(0, ...s.split(/\s+/).map(w => Array.from(w).length));

/** 두 칸 가로로 둘 때 어느 어절도 칸 한 줄을 넘지 않는가(배율은 각 글자의 확대 상한까지) */
export function pairFitsSide(p: {width: number; fontScale: number; chosen: string; other: string; signPx: number; otherPx: number; cap: number}): boolean {
  if (p.fontScale >= SIGN_PAIR_STACK_SCALE) {
    return false;
  }
  const cell = (p.width - GAP) / 2;
  const s = Math.min(p.fontScale, p.cap);
  const signRoom = cell - PAD_X * 2 - ds.line.sign * 2;
  const otherRoom = cell - PAD_X * 2 - ds.line.border * 2;
  return longestWord(p.chosen) * p.signPx * s <= signRoom && longestWord(p.other) * p.otherPx * s <= otherRoom;
}

export function SignPair({optionA, optionB, chosen, readLabel, testID = 'sign-pair'}: SignPairProps) {
  const a = useAudience();
  const {fontScale} = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const side = optionA != null && optionB != null && optionA !== optionB ? (chosen === optionA ? 'a' : chosen === optionB ? 'b' : null) : null;
  const hide = {importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true};
  if (!side) {
    return (
      <View testID={testID} {...hide}>
        <Sign size="row" label={chosen} readLabel={readLabel} />
      </View>
    );
  }
  const other = roleText('sub', a, 'muted');
  const sign = roleText('signSmall', a);
  const cap = sign.maxFontSizeMultiplier;
  // 첫 그림은 배율로만 정하고(1.5 미만 = 나란히), 폭을 잰 뒤 어절이 안 들어가면 그때 쌓는다(한 방향 — 쌓아도 폭이 같아 되돌아가지 않는다).
  // 대부분(100%·작은 배율·넓은 폭)은 바뀌는 프레임이 없다
  const stack = !pairFitsSide({
    width: measured || Infinity,
    fontScale,
    chosen,
    other: side === 'a' ? optionB! : optionA!,
    signPx: sign.style.fontSize as number,
    otherPx: other.style.fontSize as number,
    cap,
  });
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
    <View testID={testID} {...hide} style={[styles.pair, stack ? styles.stack : styles.side]} onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      {cell('a', optionA!)}
      {cell('b', optionB!)}
    </View>
  );
}

const styles = StyleSheet.create({
  pair: {gap: GAP, alignItems: 'stretch'},
  side: {flexDirection: 'row'},
  stack: {flexDirection: 'column'},
  cell: {flex: 1, minWidth: 0},
  other: {
    flexGrow: 1, minHeight: ds.sign.row.minHeight, paddingVertical: pad[0], paddingHorizontal: PAD_X,
    borderWidth: ds.line.border, borderColor: ds.color.lineSoft, borderRadius: ds.sign.radius, alignItems: 'center', justifyContent: 'center',
  },
  otherText: {textAlign: 'center'},
});
