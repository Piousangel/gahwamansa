import React from 'react';
import {StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {DeleteLink} from '../account/DeleteLink';
import {copy} from '../../copy/copy';
import {color} from '../../ui/tokens';

export function ChildReport() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  return (
    <Screen>
      <Text20 size={24} weight="bold">{copy.child.past_title}</Text20>
      <Text20>{copy.child.no_answer}</Text20>
      <DeleteLink onPress={() => navigation.navigate('DeleteAccount')} />
      {/* 앱 정보: AI 그림 고지 1줄(자녀 설정 화면이 생기면 그리로 옮긴다) */}
      <Text20 style={styles.info}>{copy.settings.ai_notice}</Text20>
    </Screen>
  );
}

const styles = StyleSheet.create({info: {color: color.inkSub, textAlign: 'center'}});
