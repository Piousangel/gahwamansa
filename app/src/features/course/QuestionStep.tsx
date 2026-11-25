import React, {useCallback, useRef, useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
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
import {FoldStack} from '../../ui/FoldStack';
import {foldPush} from '../../ui/ds/foldPush';
import {StepErrorBanner, stepErrorDock, useErrorTop} from './StepError';
import {stepA11y} from './StepHeader';
import {isServerError} from '../types';
import {errorMessage, useFinishStep, useStepStarted} from './useFinishStep';
import {stepNumber} from './fiveSteps';
import {SkipInline} from './FiveStepParts';

// review: 다 마친 뒤 보기 전용(동결 P5_P6_review). 고른 답은 바꿀 수 없고 기록 호출 0, 하단 '돌아가기'.
export function QuestionStep({navigation, route}: NativeStackScreenProps<ParentParams, 'QuestionStep'>) {
  const review = !!route.params?.review;
  // 코스 진행 중 이전(바·하드웨어 뒤로가기): 확인 없이 코스 홈으로
  const toCourseHome = useCallback(() => navigation.popTo('CourseHome'), [navigation]);
  useBackAction(toCourseHome);
  // five(스위치 + 서버 지원): 단계 번호 3/5, '오늘은 넘어갈게요'(넘김도 '했어요'), 고른 쪽은 ⑤ 카드가 쓴다(세션 picks). 아니면 아래 분기 모두 없음
  const {api, consented, content, applyAnswer, setPicks, five} = useSession();
  const n = stepNumber('question', five);
  const large = useWindowDimensions().fontScale >= 1.5;
  const {finish, error, setError} = useFinishStep();
  const errorTop = useErrorTop(error);
  useStepStarted('question', review); // AC-05
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false); // 읽어 주는 중: 읽는 글에 옅은 하늘 면
  const [viewport, setViewport] = useState(0); // R-15 FoldStack
  // 선택지 2장은 카드마다 접힘 경계에 맞춘다(첫 장이 보이면 첫 장은 첫 화면, 걸치는 장만 아래로)
  const [choiceTop, setChoiceTop] = useState<number | null>(null);
  const [choiceHeights, setChoiceHeights] = useState<number[] | null>(null);
  const choicePush = choiceTop != null && choiceHeights ? foldPush(viewport, choiceTop, choiceHeights, ds.touch.elder.gap, true) : null;
  const [choice, setChoice] = useState<'A' | 'B' | null>(content?.answered_choice ?? null);
  // 끊김 뒤 [다시 하기]는 실패한 그 행동을 다시(넘어가기였으면 넘어가기 — 답 저장 금지, QA-2 H1)
  const lastAction = useRef<'confirm' | 'skip'>('confirm');
  const q = content?.question;
  if (!q) {
    return null;
  }

  const confirm = async () => {
    if (!choice || saving) return;
    lastAction.current = 'confirm';
    setSaving(true);
    setError(null);
    try {
      // 5단계: 저장 먼저(②·⑤ saveAndFinish 와 같은 순서, 리드 결정 #254 L3). 넘긴 ③을 다시 하면 서버가 예외 'skipped' →
      // 기록(p_skipped:false) → 재저장 1회
      let finished = false;
      // 동의한 경우에만 답변 저장. 거부 시 보기만 하고 저장 함수는 호출하지 않는다.
      if (consented) { // 미연결 열람은 consented=false 로 온다
        try {
          try {
            await api.saveAnswer({questionId: q.id, choice});
          } catch (e) {
            // 넘긴 ③: 기록 → 한 번 더(5단계만)
            if (!(five && !finished && isServerError(e, 'skipped'))) throw e;
            if (!(await finish('question'))) return;
            finished = true;
            await api.saveAnswer({questionId: q.id, choice});
          }
          applyAnswer(choice); // 서버가 받은 뒤 화면 상태에도(다시 보기에서 '고른 답'으로 보임)
        } catch (e) {
          // 서버가 동의가 없다고 하면 저장 없이 그대로 진행한다(보기만 하는 흐름). 그 밖의 실패는 알린다.
          if (!isServerError(e, 'consent_required')) {
            setError(errorMessage(e));
            return;
          }
        }
      }
      if (five) {
        setPicks({question: choice});
      }
      if (finished || (await finish('question'))) {
        navigation.popTo('CourseHome'); // 쌓인 코스 홈으로 돌아간다(v7 navigate 는 새로 쌓을 수 있음)
      }
    } finally {
      setSaving(false);
    }
  };
  // 5단계 넘어가기: 답을 저장하지 않고 p_skipped 로 '했어요'(서버가 그날 답·choice_like 를 지운다). 넘긴 날 자녀 카드는 '답 없는 날'(표시 없음)
  const skip = async () => {
    if (saving) return;
    lastAction.current = 'skip';
    setSaving(true);
    setError(null);
    try {
      setPicks({question: null});
      if (await finish('question', {skipped: true})) {
        navigation.popTo('CourseHome');
      }
    } finally {
      setSaving(false);
    }
  };

  const back = {to: copy.course.to_home, onPress: toCourseHome};
  // 큰 글자(150% 이상): 단계 제목을 'n / 전체'만(P4와 같은 StepHeader compact) — 200%에서 '둘 중 고르기 · 2 / 3'의 '3'만 다음 줄로 꺾였다(#257). 읽기는 그대로
  const header = <StepHeader name={copy.course.step.question} n={n} review={review} five={five} compact={large} />;
  const title = q.prompt ?? appCopy.question_title;
  // 고정 머리줄(DECISIONS 11-25 R-2): ③은 '요즘 마음'을 묻는다는 것을 질문 위에서 먼저 말한다(콘텐츠 행은 그대로)
  const headline = <Text key="headline" testID="p5-headline" role="label">{copy.question.headline}</Text>;

  if (review) {
    // 저장된 답만 보여 준다(content.answered_choice: 오늘 KST, 동의한 어르신). 없으면(거부·철회·미연결) 이름표 없이 두 선택지만
    const saved = content?.answered_choice ?? null;
    return (
      <DsScreen
        variant="step"
        back={back}
        header={header}
        dock={{primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}}}>
        {headline}
        <Text role="title">{title}</Text>
        <ReviewChoice label={q.option_a} chosen={saved === 'A'} />
        <ReviewChoice label={q.option_b} chosen={saved === 'B'} />
      </DsScreen>
    );
  }

  // 시안 P5(ds4b): 위 BackLink '오늘 코스로'(U-8: 하단 링크 삭제). 본문(간격 20): 단계 제목 한 줄 → 머리줄 '요즘 마음 가는 쪽을 골라요' → 질문(제목) → '정답은 없어요. 하나를…'(늘 한 줄,
  // 가장 중요한 안내) → 선택지 2개(고른 것 테두리 5 + 면 + ✓ + '골랐어요') → 읽어 주기(R16: 화면 읽기 켜짐이면 없음). Dock '정했어요'.
  // R-15: 접힘에 걸치는 요소는 통째로 아래로(FoldStack)
  return (
    <DsScreen
      variant="step"
      back={back}
      stepInfo={stepA11y(copy.course.step.question, n, false, five)}
      scrollRef={errorTop}
      onViewport={setViewport}
      dock={
        error
          ? stepErrorDock(error, () => (lastAction.current === 'skip' ? skip() : confirm()))
          : {
              // 대기열 35: 5단계는 넘어가기가 있으므로 꺼진 [정했어요]의 읽기 힌트가 그 길까지 말한다(need_choice_five, ②⑤ need_choice 꼴).
              // 5단계에서는 ②⑤처럼 보이는 이유 줄 없이 힌트만(시안 s2·s3 Dock 예산 — 긴 문장이 Dock 을 키운다). 3단계는 그대로(이유 줄 + 힌트 「한쪽을 고르면 눌려요」)
              primary: five
                ? {label: copy.course.next.question, disabled: !choice, accessibilityHint: choice ? undefined : copy.question.need_choice_five, loading: saving, onPress: confirm}
                : {label: copy.course.next.question, disabled: !choice, disabledReason: copy.question.need_choice, loading: saving, onPress: confirm},
              ...(five && !large ? {secondary: {kind: 'text' as const, label: copy.keyboard.skip, disabled: saving, onPress: skip, testID: 'five-skip'}} : {}),
            }
      }>
      <FoldStack viewport={viewport} gap={20} testID="p5-body" split="choice" onTop={setChoiceTop}>
        {error ? <StepErrorBanner key="error" error={error} /> : null}
        <React.Fragment key="header">{header}</React.Fragment>
        {headline}
        {/* 질문과 안내는 따로 접힘 단위(시안 ds4b 200%: 본문 형제, 간격 20) — 한 덩어리면 320×640 200%에서 둘이 통째로 밀려 첫 화면이 비었다(에뮬레이터 실측 11-20) */}
        <View key="title" testID="p5-title" style={[styles.readBar, reading ? styles.reading : null]}>
          <Text testID={q.prompt ? 'p5-question' : undefined} role="title">{title}</Text>
        </View>
        <Text key="hint" testID="p5-hint" role="sub" tone="muted">{appCopy.question_hint}</Text>
        <Choice
          key="choice"
          onItemHeights={setChoiceHeights}
          push={choicePush}
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
        {q.prompt ? <ReadAloud key="read" text={ttsText.question(q.prompt, q.option_a, q.option_b)} onSpeaking={setReading} /> : null}
        {/* 5단계 200%: 넘어가기는 본문(②·⑤와 같은 규칙, R-12) */}
        {five && large ? <SkipInline key="skip" onPress={skip} disabled={saving} /> : null}
      </FoldStack>
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
  // 읽어 주는 중 표시: 옅은 하늘 면(글 폭·줄바꿈이 움직이지 않게 면만, 리뷰). 글자 inkTitle·inkSub 는 infoSoft 위 허용 짝
  readBar: {borderRadius: 8},
  reading: {backgroundColor: ds.color.infoSoft},
  card: {minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: ds.radius.select, borderWidth: 1.5, borderColor: ds.color.line, backgroundColor: ds.color.card, paddingVertical: 14, paddingHorizontal: 20},
  chosen: {borderWidth: 5, borderColor: ds.color.action, backgroundColor: ds.color.actionSoft, paddingHorizontal: 16.5, paddingVertical: 10.5},
  grow: {flex: 1},
  tag: {flexDirection: 'row', alignItems: 'center', gap: 8},
});
