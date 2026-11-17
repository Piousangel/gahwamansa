import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {color, radius} from '../../ui/tokens';
import {SunStamp} from '../../ui/assets/album';
import {copy} from '../../copy/copy';
import {useReduceMotion} from '../../ui/motion';
import {useScreenReader} from '../../ui/a11y';

const c = copy.course;

// 이번 주 도장 줄 7칸(design-system README §4). 붙은 날 = 해님 도장(3종 번갈아), 빈 칸 = 점선, 오늘 = 굵은 점선.
// "N일 연속" 숫자는 쓰지 않는다(쉰 날을 세지 않음). 줄 전체를 한 덩어리로, 찍은 요일만 읽는다(개수·빈 날 미언급, talkback-spec P3-5).
// appearIdx: 이 칸의 도장을 방금 찍은 것처럼 불투명도 페이드(400ms)로 보여 준다(P7). 동작 줄이기·화면 읽기에서는 바로.
export function StampRow({days, todayIdx, appearIdx}: {days: boolean[]; todayIdx: number; appearIdx?: number}) {
  const stamped = c.weekdays.filter((_, i) => days[i]);
  const label = stamped.length ? c.stamps_a11y.split('{요일}').join(stamped.join(' ')) : c.stamps_a11y_none;
  return (
    <View style={styles.card} accessible accessibilityLabel={label}>
      <Text20 size={24} weight="bold">{c.stamps_label}</Text20>
      <View style={styles.row}>
        {days.map((on, i) => (
          <View key={c.weekdays[i]} testID={`stamp-day-${i}`} style={styles.cell}>
            {on && i === appearIdx ? (
              <FadeIn>
                <SunStamp testID={`stamp-on-${i}`} variant={i} size={40} />
              </FadeIn>
            ) : on ? (
              <SunStamp testID={`stamp-on-${i}`} variant={i} size={40} />
            ) : (
              <View style={[styles.empty, i === todayIdx ? styles.today : null]} />
            )}
            <Text20 style={[styles.day, i === todayIdx ? styles.dayToday : null]}>{c.weekdays[i]}</Text20>
          </View>
        ))}
      </View>
    </View>
  );
}

function FadeIn({children}: {children: React.ReactNode}) {
  const reduce = useReduceMotion();
  const reader = useScreenReader();
  const instant = reduce || reader;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (instant) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {toValue: 1, duration: 400, useNativeDriver: true}).start();
  }, [instant, opacity]);
  return <Animated.View style={{opacity}}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  card: {backgroundColor: color.card, borderRadius: radius.card, padding: 14, gap: 8},
  row: {flexDirection: 'row', gap: 4},
  cell: {flex: 1, alignItems: 'center', gap: 2},
  empty: {width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: color.line, marginVertical: 2},
  today: {borderWidth: 3, borderColor: color.action},
  day: {color: color.inkSub, fontWeight: 'bold'},
  dayToday: {color: color.ink, textDecorationLine: 'underline'},
});
