import React, {useCallback, useState} from 'react';
import {useWindowDimensions} from 'react-native';
import {useSession} from '../../app/session';
import {Choice, DsScreen, Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {FoldStack} from '../../ui/FoldStack';
import {foldPush} from '../../ui/ds/foldPush';
import {copy} from '../../copy/copy';
import type {PassOnKey} from '../../api/contract/fiveSteps';
import {StepHeader, stepA11y} from './StepHeader';
import {StepErrorBanner, stepErrorDock, useErrorTop} from './StepError';
import {errorMessage, useFinishStep, useStepStarted} from './useFinishStep';
import {allStepsDone, passOnCards, questionLabelOf, recallWordOf, stepNumber, useFiveSteps} from './fiveSteps';
import {FIVE_CARD_MIN_H, ReviewCards, SkipInline, saveSkippable} from './FiveStepParts';

const p = copy.pass_on;

// 5단계 ⑤ 이야기 건네기(시안 docs/design/2026-11-25-five-steps s3, 문구 five-steps-copy 4절). 기능 스위치 fiveSteps 가 켜졌을 때만 닿는다.
// 위 BackLink → '이야기 건네기 · 5 / 5' → 제목 「가족에게 건넬 한 줄을 골라요」 → 문장 카드 3장(②와 같은 선택 카드, 노랑·말풍선·화살표·하트 없음, 사진 없음)
// → Dock [건넬게요] + 「오늘은 넘어갈게요」. 카드는 늘 3장(자리 1·2는 그날 한 것에 따라 둘 중 하나, 자리 3은 되묻기 + '③ 보기 A · B' 보조 줄).
// ②③을 모두 넘긴 날도 그대로 보인다(자동 생략 없음). '골랐어요'는 늘 문장 아래 줄(문장을 좁히지 않게). 200%: 넘어가기는 본문.
// 저장: 키 하나만, 동의(보여 주는 중) + 서버 플래그(pass_on_enabled) 켜짐일 때만. 「가족에게 건넸어요」는 이 화면이 아니라 P7 본문 첫 줄(저장된 날만).
// 내비는 필요한 것만(app/ 의존을 늘리지 않게 — TodayReviewScreen 과 같음). 코스 홈 바로 위에만 쌓여 하드웨어 뒤로 = 기본 goBack = 코스 홈
type Nav = {popTo(name: 'CourseHome'): void; replace(name: 'CourseDone'): void};
export function PassOnStep({navigation, route}: {navigation: Nav; route: {params?: {review?: boolean}}}) {
  const review = !!route.params?.review;
  const toCourseHome = useCallback(() => navigation.popTo('CourseHome'), [navigation]);
  const {api, consented, content, done, picks, setPicks, applySaved} = useSession();
  const five = useFiveSteps();
  const {finish, error, setError} = useFinishStep();
  const errorTop = useErrorTop(error);
  useStepStarted('pass_on', review);
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [saving, setSaving] = useState(false);
  const [viewport, setViewport] = useState(0);
  const [choiceTop, setChoiceTop] = useState<number | null>(null);
  const [choiceHeights, setChoiceHeights] = useState<number[] | null>(null);
  const [choice, setChoice] = useState<PassOnKey | null>(null);
  const lastAction = React.useRef<'confirm' | 'skip'>('confirm');
  if (!content?.photo) {
    return null;
  }
  const cards = passOnCards(recallWordOf(content, picks), questionLabelOf(content, picks), content.question);
  const n = stepNumber('pass_on', five);
  const name = copy.course.step.pass_on;

  const proceed = async (key: PassOnKey | null) => {
    if (saving) {
      return;
    }
    lastAction.current = key ? 'confirm' : 'skip';
    setSaving(true);
    setError(null);
    // 다 마친 뒤 홈에서 다시 연 경우(넘긴 ⑤ 다시 하기): 끝나면 P7 이 아니라 코스 홈으로
    const wasAll = allStepsDone(done, five);
    try {
      if (key && consented && content.pass_on_enabled) {
        try {
          await api.savePassOn(key);
          applySaved({pass_on_key: key});
        } catch (e) {
          if (!saveSkippable(e)) {
            setError(errorMessage(e));
            return;
          }
        }
      }
      const rest = picks.skipped.filter(s => s !== 'pass_on');
      setPicks({passOn: key, skipped: key ? rest : [...rest, 'pass_on']});
      if (await finish('pass_on')) {
        if (!wasAll && allStepsDone([...done, 'pass_on'], five)) {
          navigation.replace('CourseDone');
        } else {
          navigation.popTo('CourseHome');
        }
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
        <Text role="title">{p.title}</Text>
        <ReviewCards items={cards.map(c => ({key: c.key, label: c.text, sub: c.sub}))} chosen={picks.passOn ?? content.pass_on_key ?? null} />
      </DsScreen>
    );
  }

  const choicePush = choiceTop != null && choiceHeights ? foldPush(viewport, choiceTop, choiceHeights, ds.touch.elder.gap, true) : null;
  const dock: DockProps = error
    ? stepErrorDock(error, () => (lastAction.current === 'skip' ? skip() : confirm()))
    : {
        // 비활성 이유 줄은 두지 않는다(시안 s2·s3, 320×640 200% Dock 예산 — 이유는 읽기 힌트로만)
          primary: {label: p.confirm, disabled: !choice, accessibilityHint: choice ? undefined : copy.question.need_choice, loading: saving, onPress: confirm, testID: 'pass-on-confirm'},
        secondary: large ? undefined : {kind: 'text', label: copy.keyboard.skip, disabled: saving, onPress: skip, testID: 'five-skip'},
      };
  return (
    <DsScreen variant="step" back={back} stepInfo={stepA11y(name, n)} scrollRef={errorTop} onViewport={setViewport} dock={dock}>
      <FoldStack viewport={viewport} gap={12} testID="pass-on-body" split="choice" onTop={setChoiceTop}>
        {error ? <StepErrorBanner key="error" error={error} /> : null}
        <StepHeader key="header" name={name} n={n} compact={large} />
        <Text key="title" testID="pass-on-title" role="title">{p.title}</Text>
        <Choice
          key="choice"
          testID="pass-on-choice"
          accessibilityLabel={p.title}
          mode="radio"
          look="answer"
          minItemHeight={FIVE_CARD_MIN_H}
          tagBelow
          onItemHeights={setChoiceHeights}
          push={choicePush}
          // 보조 줄(③ 두 보기)은 Choice 가 힌트로도 읽는다 — 이름에 다시 넣지 않는다
          items={cards.map(c => ({key: c.key, label: c.text, hint: c.sub}))}
          value={choice ?? undefined}
          selectedLabel={copy.question.chosen}
          disabled={saving}
          onSelect={k => setChoice(k as PassOnKey)}
        />
        {large ? <SkipInline key="skip" onPress={skip} disabled={saving} /> : null}
      </FoldStack>
    </DsScreen>
  );
}
