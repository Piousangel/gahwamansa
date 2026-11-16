import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {AssetPlaceholder} from '../../ui/assets/AssetPlaceholder';
import {useSession} from '../../app/session';
import {appCopy} from '../../copy/copy';
import {useFinishStep} from './useFinishStep';

export function HangulStep({navigation}: NativeStackScreenProps<ParentParams, 'HangulStep'>) {
  const finish = useFinishStep();
  const {content} = useSession();
  if (!content) {
    return null;
  }
  return (
    <Screen>
      <Text20 size={36} weight="bold">{content.photo.keyword}</Text20>
      <Text20>{appCopy.hangul_hint}</Text20>
      <AssetPlaceholder name="writing-guide" width={300} height={200} />
      <BigButton
        label="다 썼어요"
        onPress={async () => {
          await finish('hangul');
          navigation.navigate('CourseHome');
        }}
      />
    </Screen>
  );
}
