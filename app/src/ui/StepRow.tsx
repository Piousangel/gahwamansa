import React from 'react';
import {StyleSheet, View} from 'react-native';
import {color, radius, size} from './tokens';
import {Text20} from './Text20';

export type StepStatus = 'done' | 'now' | 'wait';
type Props = {title: string; status: StepStatus; statusLabel: string};

// 명세 §7: 누르지 않는 진행 행. 상태 글자는 제목 위·아래 줄(제목이 폭 전체를 쓴다).
// done: 완료 면 + "했어요"(doneInk 7.17) / now: 선택 면 + 4px action + 제목 위 "지금 할 차례" / wait: 흰 + 2px line + "다음에 해요"
export function StepRow({title, status, statusLabel}: Props) {
  const now = status === 'now';
  return (
    <View accessible accessibilityLabel={`${title}, ${statusLabel}`} style={[styles.row, styles[status]]}>
      {now ? (
        <Text20 weight="bold" style={styles.nowLabel}>
          {statusLabel}
        </Text20>
      ) : null}
      <Text20 size={now ? 28 : 24} weight="bold" style={styles.title}>
        {title}
      </Text20>
      {now ? null : (
        <Text20 weight="bold" style={status === 'done' ? styles.doneLabel : styles.waitLabel}>
          {statusLabel}
        </Text20>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {borderRadius: radius.card, minHeight: size.stepCompact, paddingVertical: 8, paddingHorizontal: 18, justifyContent: 'center'},
  done: {backgroundColor: color.doneSoft},
  now: {backgroundColor: color.actionSoft, borderWidth: 4, borderColor: color.action, minHeight: size.stepFull, paddingVertical: 12, paddingHorizontal: 14},
  wait: {backgroundColor: color.card, borderWidth: 2, borderColor: color.line},
  title: {color: color.ink},
  nowLabel: {color: color.actionPressed},
  doneLabel: {color: color.doneInk},
  waitLabel: {color: color.inkSub},
});
