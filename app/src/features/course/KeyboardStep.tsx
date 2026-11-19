import React, {useEffect, useRef, useState} from 'react';
import {Image, Keyboard, Pressable, StyleSheet, TextInput, useWindowDimensions, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {BackBar, useBackAction} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, FONT_SCALE_MAX, radius, shadow} from '../../ui/tokens';
import {Dialog} from '../../ui/Dialog';
import {announce, useScreenReader} from '../../ui/a11y';
import {focusLater} from '../../ui/screenTitle';
import {Icon} from '../../ui/assets/icons';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {StepErrorBanner, stepErrorDock} from './StepError';
import {WordLine} from '../../ui/WordLine';
import {foldPush} from '../../ui/ds/foldPush';
import {Button, DsScreen, Heading, Text, type DockProps} from '../../ui/ds';
import {ds, roleText} from '../../ui/ds/roles';
import {useFinishStep, useStepStarted, type HangulResult} from './useFinishStep';
import {StepHeader, stepA11y} from './StepHeader';
import {ReadAloud, ttsText} from './ReadAloud';
import {confirmedCount, isMatch, normalizeWord, syllables} from './keyboardMatch';
import type {StepName} from '../types';

const k = copy.keyboard;
const STEP_ORDER: StepName[] = ['photo', 'question', 'hangul'];
// '읽어 주세요'(PX_read_aloud): 오디오 스파이크(공용 줄) 결론 전까지 자리(낱말 카드 안)만 두고 그리지 않는다(빈 버튼 노출 금지).
/** 일치 뒤 "낱말을 다 쓰셨어요"를 최소한 보여 주는 시간(시안: 1.5초 이상, 이동은 마치기로만). */
export const MATCH_HOLD_MS = 1500;
/** 이 시간이 지나거나 "다 썼어요"를 두 번 누르면 '오늘은 넘어갈게요'를 또렷하게(시안 v4 노트). */
export const SKIP_STRONG_MS = 20000;

type Phase = 'writing' | 'sheet' | 'matched';

// P6 자판으로 쓰기(설계 B + 리뷰 B항 + 시안 P6_keyboard v4).
// - 시스템 자판 그대로. 입력칸은 비제어(onChangeText 로 읽기만, value 재주입 금지: 삼성 키보드 한글 조합 깨짐 방지).
// - 판정은 keyboardMatch(NFC·공백 제거). 맞은 음절 칸만 앞에서부터 채우고 틀림 표시는 없다.
// - 입력 글자는 이 화면 안에서만 쓰고 서버·이벤트로 보내지 않는다(단계 완료만 기록).
// review: 다 마친 뒤 보기 전용(동결 P5_P6_review). '오늘의 낱말이에요' + 낱말 칸만, 입력칸·기록 없음, 하단 '돌아가기'.
// 어르신이 친 글자는 저장하지 않으므로 보여 주지 않는다(정책).
export function KeyboardStep({navigation, route}: NativeStackScreenProps<ParentParams, 'KeyboardStep'>) {
  const review = !!route.params?.review;
  const toCourseHome = () => navigation.popTo('CourseHome');
  // 하드웨어 뒤로 = BackLink 와 같은 동작(기록 없이 코스 홈). 보기 전용은 BackBar 가 맡는다
  useBackAction(review ? undefined : toCourseHome);
  const {finish, error, busy} = useFinishStep();
  useStepStarted('hangul', review); // AC-05
  const lastResult = useRef<HangulResult>('finished'); // 저장 실패 뒤 '다시 하기'도 같은 결과(finished/skipped)로
  const {content, done} = useSession();
  const {fontScale} = useWindowDimensions();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const finishRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const doneRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('writing');
  const [attempts, setAttempts] = useState(0); // "다 썼어요"를 누른 수(이벤트 attempts 정의)
  const [canFinish, setCanFinish] = useState(false);
  const [lateSkip, setLateSkip] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // #104 ②: 닫힘에서 입력 칸이 첫 화면(접힘 위)에 들어야 한다. 사진 띠가 칸을 접힘 아래로 밀면 그 크기·배율에서는 사진 띠를 접는다
  // (본보기 낱말은 카드 안에 그대로라 따라 쓰기에 지장 없음). 정한 값은 그 창 크기·배율에서만 유지(창이 바뀌면 다시 잰다)
  const [viewport, setViewport] = useState(0);
  const [cardBox, setCardBox] = useState<{y: number; h: number} | null>(null); // 자연 위치(넣은 여백 뺀 값)
  const [photoOffFor, setPhotoOffFor] = useState<string | null>(null);
  const [readH, setReadH] = useState<number | undefined>(undefined);
  const cardPushRef = useRef<number | null>(null);
  // 화면 읽기 켜짐: 자판 입력이 어려운 사용자의 대체 경로라 '넘어갈게요'를 처음부터 또렷하게(명세 P6 9번)
  const reader = useScreenReader();

  useEffect(() => {
    const t = setTimeout(() => setLateSkip(true), SKIP_STRONG_MS);
    return () => clearTimeout(t);
  }, []);
  // 자판 열림: 입력칸 포커스 + 시스템 자판 이벤트(안드로이드 뒤로가기로 자판만 닫는 경우)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    if (phase !== 'matched') {
      return undefined;
    }
    const t = setTimeout(() => setCanFinish(true), MATCH_HOLD_MS);
    // 명세 P6: 자판 닫힘 → 알림 1회 → 포커스 '마치기'. 알림 읽기가 끝나도록 마치기가 눌리는 때(1.5초)에 옮긴다(재검토 ①).
    const cancelFocus = focusLater(() => finishRef.current, MATCH_HOLD_MS);
    return () => {
      clearTimeout(t);
      cancelFocus();
    };
  }, [phase]);

  const photo = content?.photo;
  if (!photo) {
    return null;
  }
  const word = photo.keyword;
  const cells = syllables(word);
  if (review) {
    const hasImage = !photo.image_url.startsWith('pending://') && !imageFailed;
    return (
      <Screen
        top={
          <>
            <BackBar course onBack={toCourseHome} />
            <StepHeader name={copy.course.step.hangul} n={3} review />
          </>
        }
        bottom={<BigButton label={copy.review.back} accessibilityLabel={copy.nav.back_course_a11y} onPress={toCourseHome} />}>
        {/* 시안 P5_P6_review: 그림·캡션·제목·칸이 한 흰 카드 안(반경 22, 패딩 16/18, 묶음 gap 12, 낱말 묶음 안 8) */}
        <View testID="kb-review-card" style={styles.reviewCard}>
          {hasImage ? (
            <View style={styles.figure} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.reviewThumb}>
                <Image source={{uri: photo.image_url}} style={styles.reviewThumbImg} onError={() => setImageFailed(true)} />
              </View>
              <Text20 style={styles.figcaption}>{appCopy.ai_photo_label}</Text20>
            </View>
          ) : null}
          <View style={styles.reviewWord}>
            <Text20 size={22} weight="bold" style={styles.title} accessibilityElementsHidden importantForAccessibility="no">
              {copy.review.word}
            </Text20>
            <ReviewCells cells={cells} label={copy.review.word_a11y.split('{낱말}').join(word)} scale={Math.min(fontScale, FONT_SCALE_MAX)} />
          </View>
        </View>
      </Screen>
    );
  }
  const hasText = normalizeWord(text).length > 0;
  const skipStrong = reader || attempts >= 2 || lateSkip;
  const open = kbOpen && phase === 'writing';
  const large = fontScale >= 1.5;
  // 로마자 감지(시안 ds4b): 영어로 써지고 있으면 카드 아래 한 줄 안내
  const roman = phase === 'writing' && /[A-Za-z]/.test(text);
  const fitKey = `${viewport}|${fontScale}`;
  const cardBottom = cardBox ? cardBox.y + cardBox.h : 0;
  const photoOff = photoOffFor === fitKey;
  const showPhoto = !open && !photoOff && !photo.image_url.startsWith('pending://') && !imageFailed;
  if (showPhoto && viewport > 0 && cardBottom > viewport && phase === 'writing') {
    setPhotoOffFor(fitKey); // 렌더 중 상태 갱신(조건이 한 번만 참이 되도록 fitKey 로 막는다)
  }
  // R-15: 닫힘에서 카드(본보기 낱말 + 입력 칸)가 첫 화면 끝에 걸치면 통째로 아래로(200% — 시안 '닫힘 200% 입력칸은 스크롤로 닿음')
  const cardPush = open || showPhoto || !cardBox ? null : foldPush(viewport, cardBox.y, [cardBox.h], 0, true);
  cardPushRef.current = cardPush?.space ?? null;
  const readBase = cardBottom + (cardPush?.space ?? 0) + BODY_GAP;
  const readPush = roman || cardPush ? null : foldPush(viewport, readBase, [readH], 0, true);

  const matched = () => {
    Keyboard.dismiss(); // 알림이 자판에 가려지지 않게 먼저 내린다
    setKbOpen(false);
    setPhase('matched');
    announce(k.matched); // R11: 1회
  };
  const onChangeText = (t: string) => {
    setText(t); // 읽기만 한다. TextInput 에 되돌려 넣지 않는다
    if (phase === 'writing' && isMatch(t, word)) {
      matched();
    }
  };
  const pressDone = () => {
    setAttempts(a => a + 1);
    if (isMatch(text, word)) {
      matched();
      return;
    }
    Keyboard.dismiss();
    setKbOpen(false);
    setPhase('sheet');
  };
  const retry = () => {
    setPhase('writing');
    inputRef.current?.focus();
  };
  // 계측: useFinishStep 이 course_step_completed {step:'hangul', duration_sec, attempt_no, result}를 보낸다(0022·0053).
  //   result 는 finished(마치기·이대로 마칠게요)·skipped(넘어갈게요) 두 값만 — 맞았는지는 싣지 않는다(사람별 정오 기록 금지, AC-05).
  //   글자 내용은 절대 보내지 않는다. 셋 모두 같은 "단계 완료" 기록이다(평가하지 않음).
  const complete = async (result: HangulResult) => {
    lastResult.current = result;
    setPhase(p => (p === 'sheet' ? 'writing' : p));
    const willFinishCourse = STEP_ORDER.every(s => s === 'hangul' || done.includes(s));
    if (await finish('hangul', {attemptNo: attempts, result})) {
      if (willFinishCourse) {
        navigation.replace('CourseDone'); // P7: 알겠어요 → 코스 홈
      } else {
        navigation.popTo('CourseHome');
      }
    }
  };
  const skip = () => complete('skipped');
  // AI 고지(리드 결정 11-20, #95 최종·법무 체크리스트): 사진이 나오는 곳은 'AI가 만든 그림 · 실제 장소가 아니에요' 한 줄로 일관되게
  const aiNotice = `${appCopy.ai_photo_label} · ${appCopy.not_real_place}`;

  // 시안 P6_P7_N1_P2_ds4b:
  // - 닫힘: 사진 띠(+AI 고지) → '보이는 낱말을 아래 칸에 써요' → '한 글자라도 쓰면 눌려요' → 낱말 카드(따라 쓸 낱말 + 입력 칸). Dock = 다 썼어요 + 오늘은 넘어갈게요.
  // - 자판 열림: 위 영역은 BackLink 한 줄(100%는 그 줄 오른쪽 '넘어갈게요'), 본문은 낱말 카드(따라 쓸 낱말 한 줄 + 입력 칸)가 맨 위 —
  //   어떤 배율에서도 본보기 낱말이 입력 칸 바로 위에 보인다(r1/7 H). 200%는 '오늘은 넘어갈게요'를 카드 아래 본문으로(스크롤로 닿음).
  // - 일치: ✓ + '낱말을 다 쓰셨어요' + 쓰신 낱말 카드. Dock '마칠게요'는 보통 모양, 1.5초 동안 누름을 무시(표시 없음).
  const skipNode = skipStrong ? (
    <View testID="kb-skip-strong">
      <Button kind="secondary" label={k.skip} disabled={busy} onPress={skip} />
    </View>
  ) : (
    <Button kind="text" size="inline" label={k.skip} disabled={busy} onPress={skip} testID="kb-skip" />
  );
  const dock: DockProps = error
    ? stepErrorDock(error, () => complete(lastResult.current))
    : phase === 'matched'
      ? {primary: {label: k.finish, buttonRef: finishRef, loading: busy, testID: 'kb-finish', onPress: () => canFinish && complete('finished')}}
      : {
          primary: {label: copy.course.next.hangul, buttonRef: doneRef, disabled: !hasText, accessibilityHint: hasText ? undefined : k.need_one, loading: busy, onPress: pressDone},
          // 닫힘: 넘어가기는 Dock(넘치면 본문 끝으로, R-12). 자판 열림은 위 줄(100%) 또는 본문(200%)
          secondary: open ? undefined : skipStrong ? {kind: 'secondary', label: k.skip, disabled: busy, testID: 'kb-skip-strong', onPress: skip} : {kind: 'text', label: k.skip, disabled: busy, onPress: skip},
        };
  const asideSkip = open && !large ? <Button kind="text" size="inline" label={k.skip_short} accessibilityHint={k.skip} disabled={busy} onPress={skip} testID="kb-skip-top" /> : undefined;

  return (
    <DsScreen
      variant="step"
      back={{label: copy.course.to_home, onPress: toCourseHome}}
      backAside={asideSkip}
      header={<StepHeader name={copy.course.step.hangul} n={3} />}
      stepInfo={stepA11y(copy.course.step.hangul, 3)}
      onViewport={setViewport}
      dock={dock}>
      {!error ? null : <StepErrorBanner error={error} />}
      {phase === 'matched' ? (
        // 알림은 announceForAccessibility 1회만(R11). liveRegion 을 같이 두면 두 번 읽힌다
        <View style={styles.matchedGroup}>
          <View style={styles.matchedHead}>
            <Icon name="icon-check" size={MATCH_ICON} color={ds.color.doneInk} />
            <Heading level={1}>{k.matched}</Heading>
          </View>
          <View testID="kb-written" style={styles.writtenCard} accessible accessibilityLabel={`${k.your_word}, ${word}`}>
            <Text role="sub">{k.your_word}</Text>
            <Text role="title">{word}</Text>
          </View>
        </View>
      ) : open ? null : (
        <>
          {showPhoto ? (
            <View testID="kb-photo" style={styles.photoCard} accessibilityElementsHidden={false}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Image source={{uri: photo.image_url}} style={styles.photoStrip} resizeMode="cover" onError={() => setImageFailed(true)} />
              </View>
              <View style={styles.photoCaption}>
                <Text role="sub">{aiNotice}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.guide}>
            <Text role="body">{k.guide}</Text>
            <Text role="sub">{k.need_one}</Text>
          </View>
        </>
      )}
      {/* 입력칸은 상태와 관계없이 같은 자리에 둔다(다시 그려지면 비제어 입력이 지워짐). 일치 뒤에는 숨기기만 */}
      <View
        testID="kb-card"
        onLayout={e => {
          const {y, height} = e.nativeEvent.layout;
          const natural = {y: Math.round(y - (cardPushRef.current ?? 0)), h: Math.ceil(height)};
          setCardBox(b => (b && Math.abs(b.y - natural.y) < 1 && b.h === natural.h ? b : natural));
        }}
        // 자판 열림: 본보기 낱말과 입력 칸을 한 줄로(실측 360×640 Gboard: 보이는 본문 약 75dp — 위아래로 두면 시스템이 입력 칸을 보이게 스크롤해 낱말이 잘렸다, r1/7 H)
        style={[styles.wordCard, open ? styles.wordCardOpen : null, cardPush ? {marginTop: cardPush.space} : null, phase === 'matched' ? styles.hidden : null]}>
        <View accessible accessibilityLabel={k.word_a11y.split('{낱말}').join(word)}>
          <WordLine word={word} />
        </View>
        <TextInput
          ref={inputRef}
          testID="kb-input"
          accessibilityLabel={k.input_label}
          accessibilityHint={k.placeholder}
          onChangeText={onChangeText}
          onFocus={() => setKbOpen(true)}
          onBlur={() => setKbOpen(false)}
          editable={phase === 'writing'}
          importantForAutofill="no" // 자동완성 서비스가 글자 저장을 제안하지 않게(정책: 글자 미저장)
          // autoCorrect 는 지정하지 않는다: Android 에서 false 는 추천 줄까지 꺼서 "기기 설정 그대로"와 어긋남(리뷰 B).
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit
          maxFontSizeMultiplier={ds.type.fieldInput.maxFontScale}
          style={[styles.input, open ? styles.inputOpen : null, roleText('fieldInput', 'elder').style, kbOpen ? styles.inputFocused : null]}
        />
      </View>
      {roman ? (
        <Text testID="kb-roman" role="sub">{k.roman_hint}</Text>
      ) : null}
      {/* 200% 자판 열림: 넘어가기는 카드 아래 본문(스크롤로 닿음, 시안) */}
      {open && large ? skipNode : null}
      {/* AP-03 읽어 주기(시안 보드에는 없음 — 기존 기능 유지, 닫힘에서만): 낱말과 한 글자씩. 화면 읽기 켜짐이면 숨김(R16) */}
      {phase === 'writing' && !open ? (
        // R-15: 읽어 주기 버튼이 첫 화면 끝에 걸치면 통째로 아래로(카드 바로 다음 요소라 카드 아래 끝에서 위치를 잡는다 — foldPush)
        <View onLayout={e => setReadH(Math.ceil(e.nativeEvent.layout.height))} style={readPush ? {marginTop: readPush.space} : undefined}>
          <ReadAloud text={ttsText.word(word, cells)} />
        </View>
      ) : null}
      {/* 다른 낱말로 "다 썼어요": 어르신 대화상자(U0 Dialog). 뒤로가기 = 다시 써 볼게요 */}
      <Dialog
        visible={phase === 'sheet'}
        title={k.sheet_title}
        body={`${k.your_word} ${normalizeWord(text)}`}
        returnFocusRef={doneRef} // R12: 닫히면 연 버튼('다 썼어요')으로
        actions={[
          {label: k.retry, onPress: retry},
          {label: k.finish_as_is, onPress: () => complete('finished')},
        ]}
        onBack={retry}
        testID="kb-retry">
        {/* 확정된 칸만 채운다(받침 유지로 잠깐 찬 칸은 빼고, 재검토). 틀림 표시 없음 */}
        <WordCells cells={cells} filled={confirmedCount(text, word)} big idPrefix="kb-dialog-cell" />
      </Dialog>
    </DsScreen>
  );
}

// 낱말 카드: 음절 칸. 맞게 쓴 칸만 하늘색 + 확인 표시. 다른 칸은 빈 점선 칸 그대로(틀림 표시 없음).
// 화면 읽기는 카드 한 덩어리로("쓸 낱말, 나무, 두 글자 …"). 칸 변화는 읽지 않는다(소음).
// 보기 전용 낱말 칸(시안 P5_P6_review): 실선 칸, 칸 사이 10. 좁으면 한 줄을 지키며 줄어들고(flex 0 1 64),
// 글자를 키우면 칸·글자도 커진다(150% 보드: 칸 96·글자 60, 상한 1.5). 진행 화면 칸과 달리 자판과 맞출 필요가 없다.
function ReviewCells({cells, label, scale}: {cells: string[]; label: string; scale: number}) {
  const side = Math.round(64 * scale);
  return (
    <View style={styles.reviewCells} accessible accessibilityRole="image" accessibilityLabel={label}>
      {cells.map((ch, i) => (
        <View
          key={`${ch}-${i}`}
          testID={`kb-review-cell-${i}`}
          style={[styles.cell, styles.cellPlain, styles.reviewCell, {flexBasis: side, maxWidth: side}]}>
          <Text20 size={40} weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.title}>
            {ch}
          </Text20>
        </View>
      ))}
    </View>
  );
}

function WordCells({cells, filled, big, idPrefix = 'kb-cell'}: {cells: string[]; filled: number; big: boolean; idPrefix?: string}) {
  const word = cells.join('');
  const count = k.count_words[cells.length - 1] ?? String(cells.length);
  const label = k.card_a11y.split('{낱말}').join(word).split('{n}').join(count);
  const side = big ? 64 : 44;
  return (
    <View style={styles.cells} accessible accessibilityRole="image" accessibilityLabel={label}>
      {cells.map((ch, i) => {
        const on = i < filled;
        return (
          <View key={`${ch}-${i}`} testID={`${idPrefix}-${i}`} style={[styles.cell, {width: side, height: side}, on ? styles.cellOn : null]}>
            <Text20 size={big ? 40 : 28} weight="bold" maxFontSizeMultiplier={1} style={styles.title}>{ch}</Text20>
            {on ? (
              <View testID={`${idPrefix}-check-${i}`} style={styles.badge}>
                <Icon name="icon-check" size={14} color={color.onAction} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const MATCH_ICON = 36;
const BODY_GAP = 16; // ui/Screen 본문 형제 간격(layout.bodyPadding.gap)
const PHOTO_STRIP_H = 56; // 시안 ds4b 사진 띠(이미지 상자, 글자 상자 아님)
const styles = StyleSheet.create({
  // v4(시안 ds4b): 사진 띠(높이 56) + 고지 줄, 낱말 카드(흰 면 + line 1.5), 입력 칸(흰 면, 열리면 action 3)
  photoCard: {backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, overflow: 'hidden'},
  photoStrip: {height: PHOTO_STRIP_H, alignSelf: 'stretch', backgroundColor: ds.color.paperSoft},
  photoCaption: {paddingVertical: 8, paddingHorizontal: 14},
  guide: {gap: ds.space.group},
  wordCardOpen: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, paddingVertical: 6},
  inputOpen: {flexGrow: 1, flexBasis: 140},
  wordCard: {backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, paddingVertical: 3, paddingHorizontal: 14, paddingBottom: 14, gap: 4},
  matchedGroup: {gap: 20},
  matchedHead: {flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap'},
  writtenCard: {backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, paddingVertical: 14, paddingHorizontal: 18, gap: 6},
  title: {color: color.inkTitle},
  card: {backgroundColor: color.card, borderRadius: radius.card, padding: 14, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 18},
  figure: {alignItems: 'center', gap: 2},
  thumb: {width: 96, backgroundColor: color.card, paddingTop: 5, paddingHorizontal: 5, paddingBottom: 12, boxShadow: shadow.soft, transform: [{rotate: '-2deg'}]},
  thumbImg: {width: 86, height: 75, backgroundColor: color.paperSoft},
  figcaption: {color: color.ink, fontSize: 20},
  cells: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center'},
  cell: {borderRadius: 14, borderWidth: 3, borderStyle: 'dashed', borderColor: color.line, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center'},
  cellPlain: {borderStyle: 'solid', borderColor: color.action},
  reviewCard: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 12, alignItems: 'center'},
  reviewThumb: {width: 140, backgroundColor: color.card, padding: 6, boxShadow: shadow.soft, transform: [{rotate: '-2deg'}]},
  reviewThumbImg: {width: 128, height: 100, backgroundColor: color.paperSoft},
  reviewWord: {gap: 8, alignItems: 'center', alignSelf: 'stretch'},
  reviewCell: {flexGrow: 0, flexShrink: 1, aspectRatio: 1},
  reviewCells: {flexDirection: 'row', gap: 10, justifyContent: 'center', alignSelf: 'stretch'},
  cellOn: {backgroundColor: color.sky, borderStyle: 'solid', borderColor: color.action},
  badge: {position: 'absolute', right: -7, top: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: color.action, alignItems: 'center', justifyContent: 'center'},
  inputWrap: {gap: 6},
  cardOpen: {padding: 8, gap: 8},
  skipLink: {minHeight: 64, alignItems: 'center', justifyContent: 'center'},
  skipText: {textDecorationLine: 'underline', color: color.ink},
  hidden: {display: 'none'},
  // 입력칸(오목): 종이색 면 + 아래 밑줄, 높이 72 이상, 글자 34
  input: {minHeight: 56, paddingHorizontal: 16, paddingVertical: 4, backgroundColor: ds.color.card, borderRadius: ds.radius.input, borderWidth: 1.5, borderColor: ds.color.line},
  inputFocused: {borderWidth: 3, borderColor: ds.color.action},
  sub: {color: color.ink},
  matched: {alignItems: 'center', gap: 8, paddingVertical: 8},
  matchedIcon: {width: 64, height: 64, borderRadius: 32, backgroundColor: color.doneSoft, alignItems: 'center', justifyContent: 'center'},
});
