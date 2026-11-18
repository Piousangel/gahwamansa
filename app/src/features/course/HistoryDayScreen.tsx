import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {BackBar} from '../../app/BackBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {Icon} from '../../ui/assets/icons';
import {color, shadow} from '../../ui/tokens';
import {appCopy, copy} from '../../copy/copy';
import {historyDateLabel} from './stamps';
import {historyQuestion, Pair} from './HistoryScreen';

// P15 한 날(동결 시안 P15_history '지난 날 · 한 날'): 날짜 제목 · 사진(캡션·AI가 만든 그림) · "봄과 가을 중 고른 답 / 가을" · 낱말.
// 보기만(기록 호출 없음). 어르신이 친 글자는 저장하지 않으므로 없다. 동의 거부·철회 날은 고른 답 줄만 뺀다.
export function HistoryDayScreen({route}: NativeStackScreenProps<ParentParams, 'HistoryDay'>) {
  const {day} = route.params;
  const date = historyDateLabel(day.session_date);
  const [failed, setFailed] = useState(false);
  const showImage = !failed && !day.photo.image_url.startsWith('pending://');
  return (
    <Screen
      top={
        <>
          <BackBar />
          <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{date}</Text20>
        </>
      }>
      <View style={styles.polaroid}>
        {showImage ? (
          <Image source={{uri: day.photo.image_url}} style={styles.photo} accessibilityLabel={copy.history.photo_a11y.split('{caption}').join(day.photo.caption)} onError={() => setFailed(true)} />
        ) : (
          <View style={[styles.photo, styles.pending]}>
            <Icon name="icon-photo" size={40} color={color.inkSub} />
          </View>
        )}
        <Text20 size={28} style={styles.caption}>{day.photo.caption}</Text20>
      </View>
      <Text20 style={styles.sub}>{appCopy.ai_photo_label}</Text20>
      {day.choice_label ? <Pair label={historyQuestion(day)} value={day.choice_label} big /> : null}
      <Pair label={copy.history.word} value={day.photo.keyword} big />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  polaroid: {alignSelf: 'center', width: '100%', maxWidth: 300, backgroundColor: color.card, padding: 14, borderRadius: 4, boxShadow: shadow.lifted, gap: 8},
  photo: {width: '100%', aspectRatio: 272 / 236, backgroundColor: color.paperSoft, borderRadius: 2},
  pending: {alignItems: 'center', justifyContent: 'center'},
  caption: {textAlign: 'center', color: color.inkTitle},
});
