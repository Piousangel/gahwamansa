import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {color, radius} from '../../ui/tokens';
import {SunStamp} from '../../ui/assets/album';
import {copy} from '../../copy/copy';

const c = copy.course;

// 이번 주 도장 줄 7칸(design-system README §4). 붙은 날 = 해님 도장(3종 번갈아), 빈 칸 = 점선, 오늘 = 굵은 점선.
// "N일 연속" 숫자는 쓰지 않는다(쉰 날을 세지 않음). 줄 전체를 한 덩어리로 읽는다.
export function StampRow({days, todayIdx}: {days: boolean[]; todayIdx: number}) {
  const n = days.filter(Boolean).length;
  return (
    <View style={styles.card} accessible accessibilityLabel={c.stamps_a11y.split('{n}').join(String(n))}>
      <Text20 size={24} weight="bold">{c.stamps_label}</Text20>
      <View style={styles.row}>
        {days.map((on, i) => (
          <View key={c.weekdays[i]} testID={`stamp-day-${i}`} style={styles.cell}>
            {on ? (
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

const styles = StyleSheet.create({
  card: {backgroundColor: color.card, borderRadius: radius.card, padding: 14, gap: 8},
  row: {flexDirection: 'row', gap: 4},
  cell: {flex: 1, alignItems: 'center', gap: 2},
  empty: {width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: color.line, marginVertical: 2},
  today: {borderWidth: 3, borderColor: color.action},
  day: {color: color.inkSub, fontWeight: 'bold'},
  dayToday: {color: color.ink, textDecorationLine: 'underline'},
});
