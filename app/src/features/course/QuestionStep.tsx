import React, {useState} from 'react';
import {View} from 'react-native';
import {StepHeader} from './StepHeader';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {SelectCard} from '../../ui/SelectCard';
import {appCopy, copy} from '../../copy/copy';
import {StepError} from './StepError';
import {isServerError} from '../types';
import {errorMessage, useFinishStep} from './useFinishStep';

export function QuestionStep({navigation}: NativeStackScreenProps<ParentParams, 'QuestionStep'>) {
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = () => navigation.popTo('CourseHome');
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
      if (consented) { // 미연결 열람은 consented=false 로 온다
        try {
          await api.saveAnswer({questionId: q.id, choice});
        } catch (e) {
          // 서버가 동의가 없다고 하면 저장 없이 그대로 진행한다(보기만 하는 흐름). 그 밖의 실패는 알린다.
          if (!isServerError(e, 'consent_required')) {
            setError(errorMessage(e));
            return;
          }
        }
      }
      if (await finish('question')) {
        navigation.popTo('CourseHome'); // 쌓인 코스 홈으로 돌아간다(v7 navigate 는 새로 쌓을 수 있음)
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      top={
        <>
          <BackBar course onBack={toCourseHome} />
          <StepHeader name={copy.course.step.question} n={2} />
        </>
      }
      bottom={
        error ? (
          <StepError error={error} onRetry={confirm} />
        ) : (
          <BigButton
            label={copy.course.next.question}
            disabled={!choice}
            disabledReason={copy.question.need_choice}
            loading={saving}
            onPress={confirm}
          />
        )
      }>
      <Text20 size={32} weight="bold">{q.prompt ?? appCopy.question_title}</Text20>
      <Text20 size={22}>{appCopy.question_hint}</Text20>
      {/* 선택 카드 묶음은 라디오 그룹(talkback-spec R9) */}
      <View testID="choice-group" accessibilityRole="radiogroup">
        <SelectCard label={q.option_a} selected={choice === 'A'} state={saving ? 'saving' : undefined} onPress={() => setChoice('A')} />
        <SelectCard label={q.option_b} selected={choice === 'B'} state={saving ? 'saving' : undefined} onPress={() => setChoice('B')} />
      </View>
    </Screen>
  );
}
