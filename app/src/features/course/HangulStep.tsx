import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {AssetPlaceholder} from '../../ui/assets/AssetPlaceholder';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {StepError} from './StepError';
import {useFinishStep} from './useFinishStep';

export function HangulStep({navigation}: NativeStackScreenProps<ParentParams, 'HangulStep'>) {
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = () => navigation.popTo('CourseHome');
  const {finish, error, busy} = useFinishStep();
  const {content} = useSession();
  if (!content?.photo) {
    return null;
  }
  const go = async () => {
    if (await finish('hangul')) {
      navigation.popTo('CourseHome'); // 쌓인 코스 홈으로 돌아간다(v7 navigate 는 새로 쌓을 수 있음)
    }
  };
  return (
    <Screen
      top={<BackBar course onBack={toCourseHome} />}
      bottom={
        error ? <StepError error={error} onRetry={go} /> : <BigButton label={copy.course.next.hangul} loading={busy} onPress={go} />
      }>
      <Text20 size={36} weight="bold">{content.photo.keyword}</Text20>
      <Text20 size={22}>{appCopy.hangul_hint}</Text20>
      <AssetPlaceholder name="writing-guide" width={300} height={200} />
    </Screen>
  );
}
