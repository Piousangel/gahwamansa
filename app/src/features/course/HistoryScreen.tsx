import React, {useCallback, useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {BackBar} from '../../app/BackBar';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {Icon} from '../../ui/assets/icons';
import {color, radius, shadow} from '../../ui/tokens';
import {appCopy, copy, type Message} from '../../copy/copy';
import {pairShort} from '../../lib/childFormat';
import {HISTORY_MAX_DAYS, type HistoryDay} from '../../api/contract/history';
import {historyDateLabel} from './stamps';
import {errorMessage} from './useFinishStep';

const h = copy.history;

// "봄과 가을 중 고른 답"(11-7 #17c). 조사 와/과는 앞 선택지 받침으로
export const historyQuestion = (day: HistoryDay) => h.question.split('{두 선택지}').join(pairShort(day.question.option_a, day.question.option_b));

// P15 지난 날 목록(동결 시안 P15_history): 최근 30일, 폴라로이드 한 장 = 하루, 최신이 위, 빈 날 없음(달력 금지), 보기만.
// 데이터는 서버 parent_history(코스를 연 날만). 동의 거부·철회 날은 '고른 답' 줄만 빼고 문구를 넣지 않는다(11-3).
// 미연결 기기는 서버 기록이 없어 진입 자체를 숨긴다(코스 홈).
export function HistoryScreen({navigation}: NativeStackScreenProps<ParentParams, 'History'>) {
  const {api} = useSession();
  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const load = useCallback(() => {
    setError(null);
    let alive = true;
    api
      .parentHistory(HISTORY_MAX_DAYS)
      .then(r => alive && setDays(r.days))
      .catch(e => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [api]);
  useEffect(() => load(), [load]);
  const toHome = () => navigation.popTo('CourseHome');

  return (
    <Screen
      top={
        <>
          <BackBar course onBack={toHome} />
          <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{h.title}</Text20>
        </>
      }
      bottom={error ? <BigButton label={error.button} onPress={load} /> : undefined}>
      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.gap}>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </View>
      ) : days === null ? (
        <Text20 size={22}>{appCopy.loading}</Text20>
      ) : days.length === 0 ? (
        <Text20 size={22} style={styles.title}>{h.empty}</Text20>
      ) : (
        <>
          <Text20 style={styles.sub}>{h.sub}</Text20>
          {days.map(d => (
            <DayCard key={d.session_date} day={d} onPress={() => navigation.navigate('HistoryDay', {day: d})} />
          ))}
        </>
      )}
    </Screen>
  );
}

// 하루 카드(폴라로이드): 사진 + 날짜, 고른 답(있을 때만), 낱말. 누르면 한 날 화면
function DayCard({day, onPress}: {day: HistoryDay; onPress: () => void}) {
  const date = historyDateLabel(day.session_date);
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      testID={`history-item-${day.session_date}`}
      accessibilityRole="button"
      accessibilityLabel={h.day_a11y.split('{날짜}').join(date)}
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.thumb} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {failed || day.photo.image_url.startsWith('pending://') ? (
          <View style={[styles.thumbImg, styles.pending]}>
            <Icon name="icon-photo" size={28} color={color.inkSub} />
          </View>
        ) : (
          <Image source={{uri: day.photo.image_url}} style={styles.thumbImg} onError={() => setFailed(true)} />
        )}
      </View>
      <View style={styles.cardText}>
        <Text20 size={22} weight="bold" style={styles.title}>{date}</Text20>
        {day.choice_label ? <Pair label={h.chosen} value={day.choice_label} /> : null}
        <Pair label={h.word} value={day.photo.keyword} />
      </View>
      <Icon name="icon-chevron-right" size={24} color={color.ink} />
    </Pressable>
  );
}

// 이름표 + 값(두 줄). 읽기는 "이름표, 값" 한 덩어리
export function Pair({label, value, big}: {label: string; value: string; big?: boolean}) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.pair}>
      <Text20 style={styles.sub}>{label}</Text20>
      <Text20 size={big ? 28 : 22} weight="bold" style={styles.title}>{value}</Text20>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  gap: {gap: 8},
  card: {flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: color.card, borderRadius: 4, padding: 12, boxShadow: shadow.lifted},
  pressed: {backgroundColor: color.actionSoft},
  thumb: {backgroundColor: color.card, padding: 4, paddingBottom: 10, boxShadow: shadow.soft, transform: [{rotate: '-2deg'}]},
  thumbImg: {width: 96, height: 84, backgroundColor: color.paperSoft, borderRadius: 2},
  pending: {alignItems: 'center', justifyContent: 'center'},
  cardText: {flex: 1, gap: 6},
  pair: {gap: 0, borderRadius: radius.chip},
});
