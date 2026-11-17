import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useBackAction} from '../../app/BackBar';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {copy} from '../../copy/copy';
import {StampRow} from './StampRow';
import {kstWeekdayIndex, stampsFromDates} from './stamps';
import {Sun} from '../../ui/assets/sun';
import {useWeekStamps} from './useWeekStamps';

const d = copy.done;

// P7 코스 완료(시안 P7_done). 3/3을 마친 직후 한 번 보여 주고 "알겠어요"(·뒤로가기)로 코스 홈으로.
// 이번 주 도장은 서버(my_week_stamps)에서 다시 받아 오늘 칸을 페이드로 찍는다. 받지 못하면 도장 줄만 숨긴다.
// 해님은 완료 그림만(하트 없음). 칭찬하지 않고 한 일을 말한다(copy 5절).
export function CourseDone({navigation}: NativeStackScreenProps<ParentParams, 'CourseDone'>) {
  const {api, content} = useSession();
  const linked = !!content?.linked;
  // 이번 주 도장: 연결 = 서버, 미연결 = 기기 로컬(리드 결정). undefined = 받는 중(문구를 바꾸지 않게 기다림), null = 못 받음
  const week = useWeekStamps(api, content ? content.linked : undefined, 'done');
  const toHome = () => navigation.popTo('CourseHome');
  useBackAction(toHome);

  const todayIdx = kstWeekdayIndex();
  const days = week ? stampsFromDates(week.weekStart, week.doneDates) : null;
  const firstStamp = !!days && days[todayIdx] && days.filter(Boolean).length === 1;
  // 미연결(11-7 #19): 도장은 기기에 찍히고, 가족에게는 번호를 받은 뒤부터 보인다는 것을 말한다
  const body =
    week === undefined ? null : !linked ? d.unlinked_body.replace('. ', '.\n') : firstStamp ? d.first_stamp : d.body.replace('. ', '.\n');

  return (
    <Screen bottom={<BigButton label={d.button} onPress={toHome} />}>
      <View style={styles.center}>
        {/* 완료 해님(U0 sun-happy, 하트 없음, 장식이라 읽지 않음). 말풍선은 쓰지 않는다(시안 P7) */}
        <View style={styles.sun}>
          <Sun art="sun-happy" size={88} />
        </View>
        {/* 제목 포커스(R2)는 Screen 이 머리글을 받아 처리 */}
        <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.text}>{d.title}</Text20>
        {days ? <StampRow days={days} todayIdx={todayIdx} appearIdx={todayIdx} /> : null}
        {body ? (
          <Text20 size={22} weight="bold" style={styles.text} accessibilityLiveRegion="polite">{body}</Text20>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {flexGrow: 1, alignItems: 'stretch', justifyContent: 'center', gap: 16},
  text: {textAlign: 'center', alignSelf: 'center'},
  sun: {alignItems: 'center'},
});
