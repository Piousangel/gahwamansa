import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {color, radius} from '../../ui/tokens';
import {Icon} from '../../ui/assets/icons';
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
import {ToCourseHomeLink} from './ToCourseHomeLink';
import {isServerError} from '../types';
import {errorMessage, useFinishStep} from './useFinishStep';

// review: 다 마친 뒤 보기 전용(동결 P5_P6_review). 고른 답은 바꿀 수 없고 기록 호출 0, 하단 '돌아가기'.
export function QuestionStep({navigation, route}: NativeStackScreenProps<ParentParams, 'QuestionStep'>) {
  const review = !!route.params?.review;
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = () => navigation.popTo('CourseHome');
  const {api, consented, content, applyAnswer} = useSession();
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
          applyAnswer(choice); // 서버가 받은 뒤 화면 상태에도(다시 보기에서 '고른 답'으로 보임)
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

  if (review) {
    // 저장된 답만 보여 준다(content.answered_choice: 오늘 KST, 동의한 어르신). 없으면(거부·철회·미연결) 이름표 없이 두 선택지만
    const saved = content?.answered_choice ?? null;
    return (
      <Screen
        top={
          <>
            <BackBar course onBack={toCourseHome} />
            <StepHeader name={copy.course.step.question} n={2} review />
          </>
        }
        bottom={<BigButton label={copy.review.back} accessibilityLabel={copy.nav.back_course_a11y} onPress={toCourseHome} />}>
        <Text20 size={28} weight="bold" style={styles.value}>{q.prompt ?? appCopy.question_title}</Text20>
        <ReviewChoice label={q.option_a} chosen={saved === 'A'} />
        <ReviewChoice label={q.option_b} chosen={saved === 'B'} />
      </Screen>
    );
  }

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
          <>
            <BigButton
              label={copy.course.next.question}
              disabled={!choice}
              disabledReason={copy.question.need_choice}
              loading={saving}
              onPress={confirm}
            />
            <ToCourseHomeLink onPress={toCourseHome} disabled={saving} />
          </>
        )
      }>
      {/* AP-08 시안 P5_question: 제목 '마음에 드는 쪽을 골라 주세요'(32) + 보조(20, inkSub) 묶음, 그 아래 질문 문장(22 굵게) */}
      <View style={styles.titleGroup}>
        <Text20 size={32} weight="bold" style={styles.value}>{appCopy.question_title}</Text20>
        <Text20 style={styles.hint}>{appCopy.question_hint}</Text20>
      </View>
      {q.prompt ? <Text20 size={22} weight="bold" style={styles.value}>{q.prompt}</Text20> : null}
      {/* 선택 카드 묶음은 라디오 그룹(talkback-spec R9) */}
      <View testID="choice-group" accessibilityRole="radiogroup">
        <SelectCard label={q.option_a} selected={choice === 'A'} state={saving ? 'saving' : undefined} onPress={() => setChoice('A')} />
        <SelectCard label={q.option_b} selected={choice === 'B'} state={saving ? 'saving' : undefined} onPress={() => setChoice('B')} />
      </View>
    </Screen>
  );
}

// 보기 전용 선택지 칸(누르지 않음). 고른 쪽은 '고른 답' 이름표 + 다음 줄 값(11-7 #17a), 읽기 "고른 답, 봄"
function ReviewChoice({label, chosen}: {label: string; chosen: boolean}) {
  return (
    <View
      accessible
      accessibilityLabel={chosen ? copy.review.chosen_a11y.split('{값}').join(label) : label}
      style={[styles.card, chosen ? styles.chosen : null]}>
      <View style={styles.cardText}>
        {chosen ? (
          <Text20 weight="bold" oneLine style={styles.tag}>
            {copy.review.chosen}
          </Text20>
        ) : null}
        <Text20 size={32} weight="bold" style={styles.value}>
          {label}
        </Text20>
      </View>
      {chosen ? <Icon name="icon-check" size={32} color={color.done} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 시안 P5_P6_review: 선택 칸 최소 높이 100, 고른 칸 오른쪽 체크, 이름표 doneInk
  card: {minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.select, borderWidth: 2, borderColor: color.line, backgroundColor: color.card, paddingVertical: 16, paddingHorizontal: 20},
  cardText: {flex: 1, gap: 4},
  chosen: {borderWidth: 4, borderColor: color.action, backgroundColor: color.actionSoft, paddingHorizontal: 18},
  tag: {color: color.doneInk},
  value: {color: color.inkTitle},
  titleGroup: {gap: 6},
  hint: {color: color.inkSub},
});
