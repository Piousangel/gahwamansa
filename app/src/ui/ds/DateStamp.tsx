import React from 'react';
import {StyleSheet, Text as RNText, useWindowDimensions, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {useAudience} from './audience';
import {ds, roleMark, roleText} from './roles';

/**
 * 날짜 도장(D-2, DECISIONS 2026-11-24) — P3 단계 행 '했어요' 오른쪽에 찍는 먹 두 겹 원 + 날짜('24일').
 * 시안 docs/design/2026-11-24-d2-d3-c4/d2-done-mark.html ①안.
 * - 지름 64(시안 56에서 키움 — 리드 11-25: 글자 최소 20 유지, '31일'·'25일' 잉크와 안쪽 원 사이 여백 4dp 이상, 실측 근거는 d2DateStamp 시험), 바깥 선 2 + 안쪽 원(3 안쪽) 선 1, 잉크 stampInk(먹 별칭 — 새 색 없음)
 * - 글자 stampLabel(20/700), 기울기 −3° 고정(날짜는 움직이지 않는다)
 * - 지름은 글자를 따라 커진다: 64 × min(글자 배율, 역할 상한 1.3) → 200%에서 83. 고정 크기 금지
 * - 화면 읽기에서 숨긴다. 날짜는 행의 읽기 이름('사진 보기, 했어요, 24일')이 말한다(ui 는 문구를 모른다)
 * - 칭찬·평가 없이 사실(날짜)만. 동작(찍히는 순간 1회)은 아직 넣지 않았다
 */
export type DateStampProps = {
  /** 도장 안 글자(호출부 copy 에서, 예: '24일') */
  label: string;
  testID?: string;
};

const DIAMETER = 64;
const TILT = '-3deg';
const RING = 2; // 바깥 선
const INNER_INSET = 3; // 안쪽 원과 바깥 선 사이
const INNER_RING = 1;

export function DateStamp({label, testID = 'date-stamp'}: DateStampProps) {
  const a = useAudience();
  const {fontScale} = useWindowDimensions();
  const r = roleText('stampLabel', a);
  const size = Math.round(DIAMETER * Math.min(Math.max(fontScale || 1, 1), r.maxFontSizeMultiplier));
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.outer, {width: size, height: size, borderRadius: size / 2}]}>
      <View testID={`${testID}-inner`} style={styles.inner} />
      <RNText {...koreanTextProps} {...roleMark('stampLabel')} maxFontSizeMultiplier={r.maxFontSizeMultiplier} style={[r.style, styles.label]}>
        {keepAllChildren(label)}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: RING,
    borderColor: ds.color.stampInk,
    transform: [{rotate: TILT}],
  },
  inner: {
    position: 'absolute',
    top: INNER_INSET,
    left: INNER_INSET,
    right: INNER_INSET,
    bottom: INNER_INSET,
    borderRadius: DIAMETER, // 넉넉히 — 늘 원
    borderWidth: INNER_RING,
    borderColor: ds.color.stampInk,
  },
  label: {textAlign: 'center', letterSpacing: -0.4},
});
