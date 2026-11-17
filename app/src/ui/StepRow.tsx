import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {color, radius} from './tokens';
import {Text20} from './Text20';
import {Tape} from './assets/album';

export type StepStatus = 'done' | 'now' | 'wait';
type Props = {
  title: string;
  status: StepStatus;
  statusLabel: string;
  /** 주면 행 전체가 버튼(오른쪽 '›'). 코스를 다 마친 뒤 그 단계를 보기 전용으로 다시 볼 때만 준다(시안 P3 v4 B). */
  onPress?: () => void;
};

// 명세 §7 + 시안 P3 v4 리듬 규칙(D).
// - 내용 시작 = 테두리 + 패딩 = 20 고정(지금 4+16, 다음 2+18, 했어요 0+20). 세로 패딩 16, 높이는 내용으로(최소 높이 없음).
// - 한 줄 행: 16 + 제목 24(라벨 줄 높이 32) + 16 = 64. 지금 행: 16 + 테이프 28 + 8 + 32 + 16 = 100.
// - 제목·상태는 바닥선 정렬, 좁으면 상태가 다음 줄 왼쪽으로. 줄바꿈된 행은 가운데(alignContent center).
// now: 선택 면 + 4px action + 제목 위 "지금 할 차례"(뒤에 마스킹테이프, 글자는 기울이지 않음). wait 상태 글자는 보통 굵기 inkSub.
export function StepRow({title, status, statusLabel, onPress}: Props) {
  const label = `${title}, ${statusLabel}`;
  if (status === 'now') {
    return (
      <View accessible accessibilityLabel={label} style={[styles.row, styles.now]}>
        <View style={styles.labelWrap}>
          <View style={styles.tape}>
            <Tape testID="step-tape" width={140} height={28} />
          </View>
          <Text20 weight="bold" oneLine style={styles.nowLabel}>
            {statusLabel}
          </Text20>
        </View>
        <Text20 size={24} weight="bold" oneLine style={styles.title}>
          {title}
        </Text20>
      </View>
    );
  }
  const content = (
    <>
      <Text20 size={24} weight="bold" oneLine style={[styles.title, styles.inlineTitle]}>
        {title}
      </Text20>
      <Text20 oneLine style={status === 'done' ? styles.doneLabel : styles.waitLabel}>
        {statusLabel}
      </Text20>
      {onPress ? (
        <Text20 size={28} weight="bold" oneLine style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text20>
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({pressed}) => [styles.row, styles.inline, styles[status], pressed ? styles.pressed : null]}>
        {content}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, styles.inline, styles[status]]}>
      {content}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {borderRadius: radius.card, paddingVertical: 16},
  inline: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', alignContent: 'center', columnGap: 12},
  inlineTitle: {flexShrink: 1, marginRight: 'auto'},
  done: {backgroundColor: color.doneSoft, borderWidth: 0, paddingHorizontal: 20},
  now: {backgroundColor: color.actionSoft, borderWidth: 4, borderColor: color.action, paddingHorizontal: 16, gap: 8},
  wait: {backgroundColor: color.card, borderWidth: 2, borderColor: color.line, paddingHorizontal: 18},
  pressed: {opacity: 0.85},
  title: {color: color.inkTitle},
  labelWrap: {alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10},
  tape: {position: 'absolute', left: -6, top: 0, transform: [{rotate: '-2deg'}]},
  nowLabel: {color: color.actionPressed},
  doneLabel: {color: color.doneInk, fontWeight: 'bold'},
  waitLabel: {color: color.inkSub},
  chevron: {color: color.doneInk},
});
