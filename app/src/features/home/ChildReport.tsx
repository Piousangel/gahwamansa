import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {DeleteLink} from '../account/DeleteLink';
import {appCopy, copy} from '../../copy/copy';
import {color} from '../../ui/tokens';
import {formatAnswerDate} from './formatDate';
import {useChildSummary} from './useChildSummary';

// 지난 답(C5). 지금 서버가 주는 것은 최근 답 1개(child_summary)라 그 한 줄을 보여 준다.
// 여러 개 목록은 범위 결정(감사 질문 5)과 목록 RPC 가 생기면 확장한다.
export function ChildReport() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {info, error, loading, load} = useChildSummary();
  const c = copy.child;

  let body: React.ReactNode;
  if (error && !info) {
    body = (
      <View testID="child-past-error">
        <Text20 weight="bold">{error.title}</Text20>
        <Text20>{error.body}</Text20>
        <BigButton variant="secondary" label={error.button} onPress={load} />
      </View>
    );
  } else if (loading && !info) {
    body = <Text20>{appCopy.loading}</Text20>;
  } else if (info && !info.shared) {
    body = <Text20>{c.not_shared}</Text20>;
  } else if (info?.latest) {
    const a = info.latest;
    body = (
      <View testID="child-past-item" style={styles.item}>
        <Text20 style={styles.date}>{formatAnswerDate(a.answeredDate)}</Text20>
        {a.prompt ? <Text20>{a.prompt}</Text20> : null}
        <Text20 size={28} weight="bold">{a.choiceLabel}</Text20>
      </View>
    );
  } else {
    body = <Text20>{c.no_answer}</Text20>;
  }

  return (
    <Screen>
      <View testID="child-past">
        <Text20 size={24} weight="bold" accessibilityRole="header">{c.past_title}</Text20>
      </View>
      {error && info ? <Text20 weight="bold">{error.title}</Text20> : null}
      {body}
      <DeleteLink onPress={() => navigation.navigate('DeleteAccount')} />
      {/* 앱 정보: AI 그림 고지 1줄(자녀 설정 화면이 생기면 그리로 옮긴다) */}
      <Text20 style={styles.info}>{copy.settings.ai_notice}</Text20>
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: {color: color.inkSub, textAlign: 'center'},
  item: {gap: 4},
  date: {color: color.inkSub},
});
