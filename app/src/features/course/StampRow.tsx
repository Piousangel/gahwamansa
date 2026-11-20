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
// appearIdx: 이 칸의 도장을 불투명도 페이드(fadeMs, 기본 400)로 보여 준다(P7 동작 줄이기 200).
// hideIdx: 이 칸의 도장을 자리만 두고 숨긴다(P7 '쾅' 도장이 날아와 앉기 전). cellRef: 그 칸(도장이 앉을 곳) 측정용.
export function StampRow({days, todayIdx, appearIdx, fadeMs = 400, hideIdx, cellRef}: {
  days: boolean[];
  todayIdx: number;
  appearIdx?: number;
  fadeMs?: number;
  hideIdx?: number;
  cellRef?: React.Ref<React.ComponentRef<typeof View>>;
}) {
  // 읽기는 요일 전체 이름을 쉼표로(copy 11-2 #13: 한 글자 '일'·'수'는 숫자로 들림)
  const stamped = c.weekdays_a11y.filter((_, i) => days[i]);
  const label = stamped.length ? c.stamps_a11y.split('{요일}').join(stamped.join(', ')) : c.stamps_a11y_none;
  return (
    <View style={styles.card} accessible accessibilityLabel={label}>
      <Text20 size={24} weight="bold">{c.stamps_label}</Text20>
      <View style={styles.row}>
        {days.map((on, i) => (
          <View key={c.weekdays[i]} testID={`stamp-day-${i}`} style={styles.cell}>
            {on && i === hideIdx ? (
              <View ref={cellRef} style={styles.hidden}>
                <SunStamp variant={i} size={40} />
              </View>
            ) : on && i === appearIdx ? (
              <FadeIn ms={fadeMs}>
                <SunStamp testID={`stamp-on-${i}`} variant={i} size={40} />
              </FadeIn>
            ) : on ? (
              <SunStamp testID={`stamp-on-${i}`} variant={i} size={40} />
            ) : (
              // UX U6: 지난 빈 날은 원 없이 요일 글자만(채워야 할 칸으로 읽히지 않게), 오늘 굵은 점선, 이후 연한 점선
              i < todayIdx ? (
                <View testID={`stamp-past-${i}`} style={styles.past} />
              ) : (
                <View testID={`stamp-empty-${i}`} style={[styles.empty, i === todayIdx ? styles.today : styles.future]} />
              )
            )}
            <Text20 style={[styles.day, i === todayIdx ? styles.dayToday : null]}>{c.weekdays[i]}</Text20>
          </View>
        ))}
      </View>
    </View>
  );
}

function FadeIn({children, ms}: {children: React.ReactNode; ms: number}) {
  // 화면 읽기면 바로, 동작 줄이기면 200ms 페이드만(시안 P7_motion: 크기·이동 없이 페이드)
  const reduce = useReduceMotion();
  const reader = useScreenReader();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reader) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {toValue: 1, duration: reduce ? Math.min(ms, 200) : ms, useNativeDriver: true}).start();
  }, [reader, reduce, opacity, ms]);
  return <Animated.View style={{opacity}}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  card: {backgroundColor: color.card, borderRadius: radius.card, padding: 14, gap: 8},
  row: {flexDirection: 'row', gap: 4},
  cell: {flex: 1, alignItems: 'center', gap: 2},
  hidden: {opacity: 0},
  empty: {width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: color.line, marginVertical: 2},
  today: {borderWidth: 3, borderColor: color.action},
  future: {borderColor: color.lineSoft},
  past: {width: 36, height: 36, marginVertical: 2},
  day: {color: color.inkSub, fontWeight: 'bold'},
  // 오늘 요일은 누르는 것이 아니라 표시 — 파랑·밑줄은 누를 것에만(R-08). 오늘은 위 칸의 테두리가 알린다
  dayToday: {color: color.inkTitle},
});
