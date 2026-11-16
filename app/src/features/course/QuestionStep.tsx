import React, {useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {SelectCard} from '../../ui/SelectCard';
import {appCopy} from '../../copy/copy';
import {useFinishStep} from './useFinishStep';

export function QuestionStep({navigation}: NativeStackScreenProps<ParentParams, 'QuestionStep'>) {
  const {api, consented, content} = useSession();
  const finish = useFinishStep();
  const [choice, setChoice] = useState<'A' | 'B' | null>(content?.answered_choice ?? null);
  if (!content) {
    return null;
  }
  const q = content.question;

  const confirm = async () => {
    if (!choice) return;
    // 동의한 경우에만 답변 저장. 거부 시 보기만 하고 저장 함수는 호출하지 않는다.
    if (consented) {
      try {
        await api.saveAnswer({questionId: q.id, choice});
      } catch {
        // 저장 실패가 코스를 막지 않게 함(재시도는 서버 연동 단계)
      }
    }
    await finish('question');
    navigation.navigate('CourseHome');
  };

  return (
    <Screen>
      <Text20 size={32} weight="bold">{q.prompt ?? appCopy.question_title}</Text20>
      <Text20>{appCopy.question_hint}</Text20>
      <SelectCard label={q.option_a} selected={choice === 'A'} onPress={() => setChoice('A')} />
      <SelectCard label={q.option_b} selected={choice === 'B'} onPress={() => setChoice('B')} />
      <BigButton label="정했어요" disabled={!choice} onPress={confirm} />
      {!choice ? <Text20>하나를 골라 주세요</Text20> : null}
    </Screen>
  );
}
