import React, {useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {SelectCard} from '../../ui/SelectCard';
import {appCopy} from '../../copy/copy';
import {StepError} from './StepError';
import {errorMessage, useFinishStep} from './useFinishStep';

export function QuestionStep({navigation}: NativeStackScreenProps<ParentParams, 'QuestionStep'>) {
  const {api, consented, content} = useSession();
  const {finish, error, setError} = useFinishStep();
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<'A' | 'B' | null>(content?.answered_choice ?? null);
  const q = content?.question;
  if (!q) {
    return null;
  }

  const confirm = async () => {
    if (!choice || saving) return;
    setSaving(true);
    setError(null);
    try {
      // 동의한 경우에만 답변 저장. 거부 시 보기만 하고 저장 함수는 호출하지 않는다.
      if (consented) {
        try {
          await api.saveAnswer({questionId: q.id, choice});
        } catch (e) {
          // 서버가 동의가 없다고 하면 저장 없이 그대로 진행한다(보기만 하는 흐름). 그 밖의 실패는 알린다.
          if (!(e instanceof Error && e.message.includes('consent_required'))) {
            setError(errorMessage(e));
            return;
          }
        }
      }
      if (await finish('question')) {
        navigation.navigate('CourseHome');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text20 size={32} weight="bold">{q.prompt ?? appCopy.question_title}</Text20>
      <Text20>{appCopy.question_hint}</Text20>
      <SelectCard label={q.option_a} selected={choice === 'A'} onPress={() => setChoice('A')} />
      <SelectCard label={q.option_b} selected={choice === 'B'} onPress={() => setChoice('B')} />
      <BigButton label="정했어요" disabled={!choice} onPress={confirm} />
      {!choice ? <Text20>하나를 골라 주세요</Text20> : null}
      <StepError error={error} onRetry={confirm} />
    </Screen>
  );
}
