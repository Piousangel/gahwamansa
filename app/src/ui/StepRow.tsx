import React from 'react';
import {StyleSheet, View} from 'react-native';
import {color, radius, size} from './tokens';
import {Text20} from './Text20';
import {Tape} from './assets/album';

export type StepStatus = 'done' | 'now' | 'wait';
type Props = {title: string; status: StepStatus; statusLabel: string};

// 명세 §7: 누르지 않는 진행 행.
// now: 선택 면 + 4px action + 제목 위 "지금 할 차례"(뒤에 마스킹테이프, 글자는 기울이지 않음)
// done·wait: 한 줄(제목 왼쪽, 상태 오른쪽, 좁으면 줄바꿈). wait 상태 글자는 보통 굵기 inkSub(QA P3#8)
export function StepRow({title, status, statusLabel}: Props) {
  const now = status === 'now';
  if (now) {
    return (
      <View accessible accessibilityLabel={`${title}, ${statusLabel}`} style={[styles.row, styles.now]}>
        <View style={styles.labelWrap}>
          <View style={styles.tape}>
            <Tape testID="step-tape" width={140} height={36} />
          </View>
          <Text20 weight="bold" style={styles.nowLabel}>
            {statusLabel}
          </Text20>
        </View>
        <Text20 size={28} weight="bold" style={styles.title}>
          {title}
        </Text20>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={`${title}, ${statusLabel}`} style={[styles.row, styles.inline, styles[status]]}>
      <Text20 size={24} weight="bold" style={[styles.title, styles.inlineTitle]}>
        {title}
      </Text20>
      <Text20 style={status === 'done' ? styles.doneLabel : styles.waitLabel}>{statusLabel}</Text20>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {borderRadius: radius.card, minHeight: size.stepCompact, paddingVertical: 8, paddingHorizontal: 18, justifyContent: 'center'},
  inline: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12},
  inlineTitle: {flexShrink: 1, marginRight: 'auto'},
  done: {backgroundColor: color.doneSoft},
  now: {backgroundColor: color.actionSoft, borderWidth: 4, borderColor: color.action, minHeight: size.stepFull, paddingVertical: 12, paddingHorizontal: 14},
  wait: {backgroundColor: color.card, borderWidth: 2, borderColor: color.line},
  title: {color: color.ink},
  labelWrap: {alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10, minHeight: 36},
  tape: {position: 'absolute', left: -6, top: 0, transform: [{rotate: '-2deg'}]},
  nowLabel: {color: color.actionPressed},
  doneLabel: {color: color.doneInk, fontWeight: 'bold'},
  waitLabel: {color: color.inkSub},
});
