import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {color} from '../../ui/tokens';
import {copy} from '../../copy/copy';
import {useScreenTitleRef} from '../../ui/screenTitle';

// 단계 화면 제목 줄(P4·P5): "사진 보기   1 / 3". 화면 읽기는 한 덩어리로 "사진 보기, 3단계 중 1단계"(talkback-spec R4).
// 화면 제목 포커스(R2) 대상: Text20 머리글과 같은 경로(useScreenTitleRef)로 등록한다.
const TOTAL_STEPS = 3;

// review: 보기 전용(다시 보기). 단계 표시를 숨기고 읽기는 "사진 보기, 다시 보는 중"(11절 11b, 기록이 안 남는다는 것을 알림).
export function StepHeader({name, n, review}: {name: string; n: 1 | 2 | 3; review?: boolean}) {
  const titleRef = useScreenTitleRef(true);
  // copy-v3 11절 11번: "{단계}, {전체}단계 중 {n}단계" → "사진 보기, 3단계 중 1단계"
  const label = review
    ? copy.course.step_review_a11y.split('{단계}').join(name)
    : copy.course.step_a11y
    .split('{단계}').join(name)
    .split('{전체}').join(String(TOTAL_STEPS))
    .split('{n}').join(String(n));
  return (
    <View ref={titleRef} testID="step-header" style={styles.row} accessible accessibilityRole="header" accessibilityLabel={label}>
      <Text20 size={26} weight="bold" style={styles.name}>{name}</Text20>
      {review ? null : <Text20 size={22} weight="bold" style={styles.count}>{`${n} / ${TOTAL_STEPS}`}</Text20>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12},
  name: {color: color.inkTitle},
  count: {color: color.inkSub},
});
