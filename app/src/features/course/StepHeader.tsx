import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text20 } from '../../ui/Text20';
import { color } from '../../ui/tokens';
import { copy } from '../../copy/copy';

// 단계 화면 제목 줄(P4·P5): "사진 보기   1 / 3". 화면 읽기는 한 덩어리로 "사진 보기, 3단계 중 1단계"(talkback-spec R4).
export function StepHeader({ name, n }: { name: string; n: 1 | 2 | 3 }) {
  const label = copy.course.step_a11y
    .split('{name}')
    .join(name)
    .split('{n}')
    .join(String(n));
  return (
    <View
      testID="step-header"
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={label}
    >
      <Text20 size={26} weight="bold" style={styles.name}>
        {name}
      </Text20>
      <Text20 size={22} weight="bold" style={styles.count}>{`${n} / 3`}</Text20>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  name: { color: color.inkTitle },
  count: { color: color.inkSub },
});
