import React, {useCallback, useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSession} from '../../app/session';
import {Choice, DsScreen, Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {FoldStack} from '../../ui/FoldStack';
import {foldPush} from '../../ui/ds/foldPush';
import {copy} from '../../copy/copy';
import {StepHeader, stepA11y} from './StepHeader';
import {StepErrorBanner, stepErrorDock, useErrorTop} from './StepError';
import {errorMessage, useFinishStep, useStepStarted} from './useFinishStep';
import {stepNumber} from './fiveSteps';
import {FIVE_CARD_MIN_H, PhotoThumbRow, ReviewCards, SkipInline, saveAndFinish} from './FiveStepParts';

const r = copy.recall;

// 5단계 ② 떠올려 보기(시안 docs/design/2026-11-25-five-steps s2, 문구 five-steps-copy 1절). 5단계(스위치 + 서버 지원)일 때만 닿는다.
// 위 BackLink '오늘 코스로' → '떠올려 보기 · 2 / 5'(150% 이상 '2 / 5') → 사진 80 + AI 고지(사진 이름은 ①에서 봤으므로 뺌)
// → 질문(30일 같은 한 문장) → 「정답은 없어요」 → 낱말 카드(서버 recall.options, 세로, 최소 64) → 「오늘은 넘어갈게요」(카드 아래 본문) → Dock [이걸로 할게요].
// 카드 1탭 = 테두리 5 + 면 + ✓ '골랐어요'(P5와 같음), 확정은 Dock(2탭 안전장치). 200%: '골랐어요'는 낱말 아래 줄.
// 넘어가기는 100%도 본문(#254 캡처 문제 4 — 100% 첫 화면에 카드가 0장이었다. 200%는 R-12 로 원래 본문)
// 저장: 동의(답을 보여 주는 중)일 때만 save_recall(day_index, slot). 넘긴 날은 p_skipped 로 기록하고 저장하지 않는다(자녀 무표시).
// 보기가 없는 날(options = [])은 넘어가기 하나만 — 그래도 p_skipped 로 기록한다(안 하면 도장이 찍히지 않는다, 계약 규칙).
// 고른 낱말은 ④·⑤가 쓴다(세션 picks → 서버 picked_slot). review: 다 마친 뒤 보기 전용 — 기록·저장 호출 0, 하단 '오늘 코스로'.
// 내비는 필요한 것만(app/ 의존을 늘리지 않게 — TodayReviewScreen 과 같음). 코스 홈 바로 위에만 쌓여 하드웨어 뒤로 = 기본 goBack = 코스 홈
type Nav = {popTo(name: 'CourseHome'): void; replace(name: 'CourseDone'): void};
export function RecallStep({navigation, route}: {navigation: Nav; route: {params?: {review?: boolean}}}) {
  const review = !!route.params?.review;
  const toCourseHome = useCallback(() => navigation.popTo('CourseHome'), [navigation]);
  const {api, consented, content, picks, setPicks, applySaved, five, sync} = useSession();
  const {finish, error, setError} = useFinishStep();
  const errorTop = useErrorTop(error);
  useStepStarted('recall', review);
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [saving, setSaving] = useState(false);
  const [viewport, setViewport] = useState(0);
  const [choiceTop, setChoiceTop] = useState<number | null>(null);
  const [choiceHeights, setChoiceHeights] = useState<number[] | null>(null);
  const saved = picks.recall ?? content?.recall?.picked_slot ?? null;
  const [choice, setChoice] = useState<number | null>(saved);
  const lastAction = React.useRef<'confirm' | 'skip'>('confirm');
  const photo = content?.photo;
  if (!photo || !content) {
    return null;
  }
  const options = content.recall?.options ?? [];
  const items = options.map(o => ({key: String(o.slot), label: o.label}));
  const n = stepNumber('recall', five);
  const name = copy.course.step.recall;

  // picked = null 이면 넘어가기(p_skipped). 저장 실패(끊김)는 알리고 멈춘다 — 서버 거절은 저장 없이 진행, 지난 날이면 다시 불러 홈으로
  const proceed = async (picked: number | null) => {
    if (saving) {
      return;
    }
    lastAction.current = picked != null ? 'confirm' : 'skip';
    setSaving(true);
    setError(null);
    try {
      if (picked == null) {
        setPicks({recall: null});
        if (await finish('recall', {skipped: true})) {
          navigation.popTo('CourseHome');
        }
        return;
      }
      setPicks({recall: picked});
      const out = await saveAndFinish({
        save: consented && content.linked ? () => api.saveRecall(content.day_index, picked) : null,
        finish: () => finish('recall'),
      });
      if (out.saved) {
        applySaved({picked_slot: picked});
      }
      if (out.result === 'stale') {
        await sync();
        navigation.popTo('CourseHome');
      } else if (out.result === 'ok') {
        navigation.popTo('CourseHome');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const skip = () => proceed(null);
  const confirm = () => (choice != null ? proceed(choice) : undefined);
  const back = {to: copy.course.to_home, onPress: toCourseHome};

  if (review) {
    return (
      <DsScreen
        variant="step"
        back={back}
        header={<StepHeader name={name} n={n} review five={five} />}
        dock={{primary: {label: copy.review.back, accessibilityHint: copy.nav.back_course_a11y, onPress: toCourseHome}}}>
        <PhotoThumbRow uri={photo.image_url} large={large} />
        <Text role="title">{r.question}</Text>
        <ReviewCards items={items} chosen={saved != null ? String(saved) : null} />
      </DsScreen>
    );
  }

  const hasOptions = options.length > 0;
  const choicePush = choiceTop != null && choiceHeights ? foldPush(viewport, choiceTop, choiceHeights, ds.touch.elder.gap, true) : null;
  const dock: DockProps = error
    ? stepErrorDock(error, () => (lastAction.current === 'skip' ? skip() : confirm()))
    : hasOptions
      ? {
          // 비활성 이유 줄은 두지 않는다(시안 s2·s3, 320×640 200% Dock 예산 — 이유는 읽기 힌트로만)
          // 넘어가기는 배율과 상관없이 카드 아래 본문(#254 캡처 문제 4, 시안 리스크 3의 둘째 안). 100% 360×640 실측: 본문 창 298 에서
          // 첫 카드가 266~339 라 R-15 가 밀어 첫 화면에 카드가 0장이었다. Dock 보조 줄(56 + 4)을 빼면 창 358 → 첫 카드가 첫 화면에 든다.
          // 사진·간격·「정답은 없어요」 붙이기를 다 줄여도 26 이라 모자랐다(필요 41). 질문·정답 없음 문구는 그대로 둔다
          // 넘어가기가 첫 화면 밖에 있으니, 꺼진 주 버튼의 읽기 힌트가 그 길을 알린다(#259 QA-2 M2)
          primary: {label: r.confirm, disabled: choice == null, accessibilityHint: choice != null ? undefined : r.need_choice, loading: saving, onPress: confirm, testID: 'recall-confirm'},
        }
      : // 그날 보기가 없으면(no_content) 넘어가기 하나만 — 막히는 단계를 만들지 않는다
        {primary: {kind: 'secondary', label: copy.keyboard.skip, loading: saving, onPress: skip, testID: 'five-skip'}};
  return (
    <DsScreen variant="step" back={back} stepInfo={stepA11y(name, n, false, five)} scrollRef={errorTop} onViewport={setViewport} dock={dock}>
      <FoldStack viewport={viewport} gap={BODY_GAP} testID="recall-body" split="choice" onTop={setChoiceTop}>
        {error ? <StepErrorBanner key="error" error={error} /> : null}
        <StepHeader key="header" name={name} n={n} compact={large} five={five} />
        <PhotoThumbRow key="photo" uri={photo.image_url} large={large} />
        <Text key="question" testID="recall-question" role="title">{r.question}</Text>
        <Text key="hint" testID="recall-hint" role="sub" tone="muted">{r.hint}</Text>
        {hasOptions ? (
          <Choice
            key="choice"
            testID="recall-choice"
            accessibilityLabel={r.question}
            mode="radio"
            look="answer"
            minItemHeight={FIVE_CARD_MIN_H}
            tagBelow={large}
            onItemHeights={setChoiceHeights}
            push={choicePush}
            items={items}
            value={choice != null ? String(choice) : undefined}
            selectedLabel={copy.question.chosen}
            disabled={saving}
            onSelect={k => setChoice(Number(k))}
          />
        ) : null}
        {hasOptions ? (
          // 마지막 카드와 넘어가기 사이 = 묶음 간격(section 32). 카드끼리(12)보다 넓혀 마지막 카드를 누르려다 넘어가기를 누르지 않게,
          // 또 '고르기'와 다른 길로 읽히게(#259 QA-2 M2). 묶음 간격 12 + 위 여백 20
          <View key="skip" testID="recall-skip-gap" style={styles.skipGap}>
            <SkipInline onPress={skip} disabled={saving} />
          </View>
        ) : null}
      </FoldStack>
    </DsScreen>
  );
}

const BODY_GAP = 12;
const styles = StyleSheet.create({
  skipGap: {paddingTop: ds.space.section - BODY_GAP},
});
