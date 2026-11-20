import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon} from '../../ui/assets/icons';
import {ds} from '../../ui/ds/roles';
import {copy} from '../../copy/copy';

const c = copy.course;

/**
 * P7 이번 주 도장 줄(시안 P7_album_ds4): 7칸, 찍은 날 = actionSoft 면 + action 테두리 + ✓(doneInk), 빈 날 = 흰 면 + line 테두리.
 * 숫자·연속일·요일 글자 없음(칭찬·연속 보상 금지). 읽기는 줄 전체 한 번 — 찍은 요일만(개수·빈 날 미언급, talkback-spec P3-5, StampRow 와 같은 문구).
 * 오너가 '7칸 도장 줄 삭제'를 검토 중이라 이 컴포넌트 하나 + 아래 플래그 하나로 P3·P7 에서 함께 빠지게 둔다.
 */
/** 이번 주 도장 줄(P3·P7)을 보일지. 오너가 빼기로 하면 SHOW_WEEK_STRIP 기본값 한 곳만 false. 테스트는 setWeekStripForTest 로 끈다(PR #108 리뷰 L3) */
const SHOW_WEEK_STRIP = false; // 오너 결정 O-6(DECISIONS 11-20): 이번 주 도장 7칸을 뺀다. 컴포넌트는 남기고 끈다
let weekStripOverride: boolean | null = null;
export const showWeekStrip = () => weekStripOverride ?? SHOW_WEEK_STRIP;
export function setWeekStripForTest(v: boolean | null) {
  weekStripOverride = v;
}
export function WeekStampStrip({days, testID = 'week-strip'}: {days: boolean[]; testID?: string}) {
  const stamped = c.weekdays_a11y.filter((_, i) => days[i]);
  const label = stamped.length ? c.stamps_a11y.split('{요일}').join(stamped.join(', ')) : c.stamps_a11y_none;
  return (
    <View testID={testID} style={styles.row} accessible accessibilityLabel={label}>
      {days.map((on, i) => (
        <View key={c.weekdays[i]} testID={on ? `stamp-on-${i}` : `stamp-empty-${i}`} style={[styles.cell, on ? styles.on : styles.off]}>
          {on ? <Icon name="icon-check" size={CHECK} color={ds.color.doneInk} /> : null}
        </View>
      ))}
    </View>
  );
}

const CELL_MAX = 44; // 시안: 칸 최대 44, 좁으면 7칸이 폭을 나눠 줄어든다
const CHECK = 20;

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: ds.space.group, justifyContent: 'center', alignSelf: 'stretch'},
  cell: {flex: 1, maxWidth: CELL_MAX, aspectRatio: 1, borderRadius: ds.radius.chip, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center'},
  on: {backgroundColor: ds.color.actionSoft, borderColor: ds.color.action},
  off: {backgroundColor: ds.color.card, borderColor: ds.color.line},
});
