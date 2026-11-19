import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon} from '../../ui/assets/icons';
import {StepHeader} from './StepHeader';
import {ReadAloud, ttsText} from './ReadAloud';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Choice, DsScreen, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {useBackAction} from '../../app/BackBar';
import {appCopy, copy} from '../../copy/copy';
import {StepErrorBanner, stepErrorDock} from './StepError';
import {isServerError} from '../types';
import {errorMessage, useFinishStep, useStepStarted} from './useFinishStep';

// review: 다 마친 뒤 보기 전용(동결 P5_P6_review). 고른 답은 바꿀 수 없고 기록 호출 0, 하단 '돌아가기'.
export function QuestionStep({navigation, route}: NativeStackScreenProps<ParentParams, 'QuestionStep'>) {
  const review = !!route.params?.review;
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = () => navigation.popTo('CourseHome');
  useBackAction(toCourseHome);
  const {api, consented, content, applyAnswer} = useSession();
  const {finish, error, setError} = useFinishStep();
  useStepStarted('question', review); // AC-05
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false); // 읽어 주는 중: 읽는 문장에 하늘색 밑줄
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

  const back = {label: copy.course.to_home, onPress: toCourseHome};
  const header = <StepHeader name={copy.course.step.question} n={2} review={review} />;
  const title = q.prompt ?? appCopy.question_title;

  if (review) {
    // 저장된 답만 보여 준다(content.answered_choice: 오늘 KST, 동의한 어르신). 없으면(거부·철회·미연결) 이름표 없이 두 선택지만
    const saved = content?.answered_choice ?? null;
    return (
      <DsScreen
        variant="step"
        back={back}
        header={header}
        dock={{primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}}}>
        <Text role="title">{title}</Text>
        <ReviewChoice label={q.option_a} chosen={saved === 'A'} />
        <ReviewChoice label={q.option_b} chosen={saved === 'B'} />
      </DsScreen>
    );
  }

  // 시안 P5(ds4b): 위 BackLink '오늘 코스로'(U-8: 하단 링크 삭제), 단계 제목 한 줄 → 질문(제목) → '정답은 없어요…'(늘 한 줄, 가장 중요한 안내)
  // → 선택지 2개(고른 것 테두리 5 + 면 + ✓ + '골랐어요') → Dock '정했어요'. 읽어 주기는 선택지 아래(R16: 화면 읽기 켜짐이면 없음)
  return (
    <DsScreen
      variant="step"
      back={back}
      header={header}
      dock={
        error
          ? stepErrorDock(error, confirm)
          : {primary: {label: copy.course.next.question, disabled: !choice, disabledReason: copy.question.need_choice, loading: saving, onPress: confirm}}
      }>
      {error ? <StepErrorBanner error={error} /> : null}
      <View testID="p5-title-group" style={[styles.titleGroup, reading ? styles.reading : null]}>
        <Text testID={q.prompt ? 'p5-question' : undefined} role="title">{title}</Text>
        <Text testID="p5-hint" role="sub" tone="muted">{appCopy.question_hint}</Text>
      </View>
      <Choice
        testID="choice-group"
        mode="radio"
        look="answer"
        items={[
          {key: 'A', label: q.option_a},
          {key: 'B', label: q.option_b},
        ]}
        value={choice ?? undefined}
        selectedLabel={copy.question.chosen}
        disabled={saving}
        onSelect={k => setChoice(k as 'A' | 'B')}
      />
      {/* AP-03 읽어 주기: 선택지 아래. 질문과 두 선택지를 읽는다 */}
      {q.prompt ? <ReadAloud text={ttsText.question(q.prompt, q.option_a, q.option_b)} onSpeaking={setReading} /> : null}
    </DsScreen>
  );
}

// 보기 전용 선택지 칸(누르지 않음). 고른 쪽은 '고른 답' + ✓(P5 고른 표시와 같은 모양: 테두리 5·면), 읽기 "고른 답, 봄"
function ReviewChoice({label, chosen}: {label: string; chosen: boolean}) {
  return (
    <View
      accessible
      accessibilityLabel={chosen ? copy.review.chosen_a11y.split('{값}').join(label) : label}
      style={[styles.card, chosen ? styles.chosen : null]}>
      <Text role="title" style={styles.grow}>{label}</Text>
      {chosen ? (
        <View style={styles.tag}>
          <Icon name="icon-check" size={28} color={ds.color.doneInk} />
          <Text role="bodyLg" tone="done">{copy.review.chosen}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 읽어 주는 중: 읽는 글 왼쪽에 하늘색 막대
  reading: {borderLeftWidth: 4, borderLeftColor: ds.color.info, paddingLeft: 10},
  card: {minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: ds.radius.select, borderWidth: 1.5, borderColor: ds.color.line, backgroundColor: ds.color.card, paddingVertical: 14, paddingHorizontal: 20},
  chosen: {borderWidth: 5, borderColor: ds.color.action, backgroundColor: ds.color.actionSoft, paddingHorizontal: 16.5},
  grow: {flex: 1},
  tag: {flexDirection: 'row', alignItems: 'center', gap: 8},
  titleGroup: {gap: 20},
});
