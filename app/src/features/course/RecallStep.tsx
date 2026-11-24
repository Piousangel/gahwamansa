import React, {useCallback, useState} from 'react';
import {useWindowDimensions} from 'react-native';
import {useSession} from '../../app/session';
import {Choice, DsScreen, Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {FoldStack} from '../../ui/FoldStack';
import {foldPush} from '../../ui/ds/foldPush';
import {copy} from '../../copy/copy';
import type {RecallChoice} from '../../api/contract/fiveSteps';
import {StepHeader, stepA11y} from './StepHeader';
import {StepErrorBanner, stepErrorDock, useErrorTop} from './StepError';
import {errorMessage, useFinishStep, useStepStarted} from './useFinishStep';
import {stepNumber, useFiveSteps} from './fiveSteps';
import {FIVE_CARD_MIN_H, PhotoThumbRow, ReviewCards, SkipInline, saveSkippable} from './FiveStepParts';

const r = copy.recall;

// 5단계 ② 떠올려 보기(시안 docs/design/2026-11-25-five-steps s2, 문구 five-steps-copy 1절). 기능 스위치 fiveSteps 가 켜졌을 때만 닿는다.
// 위 BackLink '오늘 코스로' → '떠올려 보기 · 2 / 5'(150% 이상 '2 / 5') → 사진 80 + AI 고지(사진 이름은 ①에서 봤으므로 뺌)
// → 질문(30일 같은 한 문장) → 「정답은 없어요」 → 낱말 카드 3장(세로, 최소 64) → Dock [이걸로 할게요] + 「오늘은 넘어갈게요」.
// 카드 1탭 = 테두리 5 + 면 + ✓ '골랐어요'(P5와 같음), 확정은 Dock(2탭 안전장치). 200%: '골랐어요'는 낱말 아래 줄, 넘어가기는 카드 아래 본문(R-12).
// 저장: 동의(답을 보여 주는 중)일 때만 보기 번호를 저장한다. 넘긴 날은 저장하지 않고 아무 표시도 없다. 고른 낱말은 ④·⑤가 쓴다(세션 picks).
// review: 다 마친 뒤 보기 전용 — 기록·저장 호출 0, 하단 '오늘 코스로'.
// 내비는 필요한 것만(app/ 의존을 늘리지 않게 — TodayReviewScreen 과 같음). 코스 홈 바로 위에만 쌓여 하드웨어 뒤로 = 기본 goBack = 코스 홈
type Nav = {popTo(name: 'CourseHome'): void; replace(name: 'CourseDone'): void};
export function RecallStep({navigation, route}: {navigation: Nav; route: {params?: {review?: boolean}}}) {
  const review = !!route.params?.review;
  const toCourseHome = useCallback(() => navigation.popTo('CourseHome'), [navigation]);
  const {api, consented, content, picks, setPicks, applySaved} = useSession();
  const five = useFiveSteps();
  const {finish, error, setError} = useFinishStep();
  const errorTop = useErrorTop(error);
  useStepStarted('recall', review);
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [saving, setSaving] = useState(false);
  const [viewport, setViewport] = useState(0);
  const [choiceTop, setChoiceTop] = useState<number | null>(null);
  const [choiceHeights, setChoiceHeights] = useState<number[] | null>(null);
  const saved = picks.recall ?? content?.recall_choice ?? null;
  const [choice, setChoice] = useState<RecallChoice | null>(saved);
  const lastAction = React.useRef<'confirm' | 'skip'>('confirm');
  const photo = content?.photo;
  if (!photo) {
    return null;
  }
  const options = content?.recall?.options ?? null;
  const items = (options ?? []).map((label, i) => ({key: String(i + 1), label}));
  const n = stepNumber('recall', five);
  const name = copy.course.step.recall;

  // picked = null 이면 넘어가기. 저장 실패(끊김)는 알리고 멈춘다 — 동의 없음·계약 전은 저장 없이 진행
  const proceed = async (picked: RecallChoice | null) => {
    if (saving) {
      return;
    }
    lastAction.current = picked ? 'confirm' : 'skip';
    setSaving(true);
    setError(null);
    try {
      if (picked && consented) {
        try {
          await api.saveRecallChoice(picked);
          applySaved({recall_choice: picked});
        } catch (e) {
          if (!saveSkippable(e)) {
            setError(errorMessage(e));
            return;
          }
        }
      }
      setPicks(picked ? {recall: picked} : {recall: null, skipped: [...picks.skipped.filter(s => s !== 'recall'), 'recall']});
      if (await finish('recall')) {
        navigation.popTo('CourseHome');
      }
    } finally {
      setSaving(false);
    }
  };
  const skip = () => proceed(null);
  const confirm = () => (choice ? proceed(choice) : undefined);
  const back = {to: copy.course.to_home, onPress: toCourseHome};

  if (review) {
    return (
      <DsScreen
        variant="step"
        back={back}
        header={<StepHeader name={name} n={n} review />}
        dock={{primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}}}>
        <PhotoThumbRow uri={photo.image_url} large={large} />
        <Text role="title">{r.question}</Text>
        <ReviewCards items={items} chosen={saved ? String(saved) : null} />
      </DsScreen>
    );
  }

  const choicePush = choiceTop != null && choiceHeights ? foldPush(viewport, choiceTop, choiceHeights, ds.touch.elder.gap, true) : null;
  const dock: DockProps = error
    ? stepErrorDock(error, () => (lastAction.current === 'skip' ? skip() : confirm()))
    : options
      ? {
          // 비활성 이유 줄은 두지 않는다(시안 s2·s3, 320×640 200% Dock 예산 — 이유는 읽기 힌트로만)
          primary: {label: r.confirm, disabled: !choice, accessibilityHint: choice ? undefined : copy.question.need_choice, loading: saving, onPress: confirm, testID: 'recall-confirm'},
          secondary: large ? undefined : {kind: 'text', label: copy.keyboard.skip, disabled: saving, onPress: skip, testID: 'five-skip'},
        }
      : // 그날 보기가 없으면(콘텐츠 구멍) 넘어가기 하나만 — 막히는 단계를 만들지 않는다
        {primary: {kind: 'secondary', label: copy.keyboard.skip, loading: saving, onPress: skip, testID: 'five-skip'}};
  return (
    <DsScreen variant="step" back={back} stepInfo={stepA11y(name, n)} scrollRef={errorTop} onViewport={setViewport} dock={dock}>
      <FoldStack viewport={viewport} gap={12} testID="recall-body" split="choice" onTop={setChoiceTop}>
        {error ? <StepErrorBanner key="error" error={error} /> : null}
        <StepHeader key="header" name={name} n={n} compact={large} />
        <PhotoThumbRow key="photo" uri={photo.image_url} large={large} />
        <Text key="question" testID="recall-question" role="title">{r.question}</Text>
        <Text key="hint" testID="recall-hint" role="sub" tone="muted">{r.hint}</Text>
        {options ? (
          <Choice
            key="choice"
            testID="recall-choice"
            mode="radio"
            look="answer"
            minItemHeight={FIVE_CARD_MIN_H}
            tagBelow={large}
            onItemHeights={setChoiceHeights}
            push={choicePush}
            items={items}
            value={choice ? String(choice) : undefined}
            selectedLabel={copy.question.chosen}
            disabled={saving}
            onSelect={k => setChoice(Number(k) as RecallChoice)}
          />
        ) : null}
        {options && large ? <SkipInline key="skip" onPress={skip} disabled={saving} /> : null}
      </FoldStack>
    </DsScreen>
  );
}
