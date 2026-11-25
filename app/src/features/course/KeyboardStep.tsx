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
import {AiNotice} from '../../ui/AiNotice';
import {PHOTO_FIT_SLACK, photoFrame} from './photoFrame';
import {usePhotoLoad} from './usePhotoLoad';
import {fillObject} from '../../lib/josa';
import {StepHeader, stepA11y} from './StepHeader';
import {ReadAloud, ttsText} from './ReadAloud';
import {confirmedCount, isMatch, normalizeWord, syllables} from './keyboardMatch';
import {allStepsDone, courseStepNames, recallWordOf, stepNumber} from './fiveSteps';

const k = copy.keyboard;
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
// 입력 칸 글자: fieldInput 역할에서 줄높이만 뺀다. Android TextInput 은 줄높이를 글자 배율로 늘리지 않아(글자 34×1.5=51 > 줄높이 44)
// 글자 위쪽이 잘렸다(에뮬레이터 320·360 × 200% 실측, 11-20). 높이는 minHeight·세로 가운데로 맞춘다
const inputText = {...roleText('fieldInput', 'elder').style, lineHeight: undefined, textAlignVertical: 'center' as const, includeFontPadding: false};

export function KeyboardStep({navigation, route}: NativeStackScreenProps<ParentParams, 'KeyboardStep'>) {
  const review = !!route.params?.review;
  const toCourseHome = () => navigation.popTo('CourseHome');
  // 하드웨어 뒤로 = BackLink 와 같은 동작(기록 없이 코스 홈). 보기 전용은 BackBar 가 맡는다
  useBackAction(review ? undefined : toCourseHome);
  const {finish, error, busy} = useFinishStep();
  useStepStarted('hangul', review); // AC-05
  const lastResult = useRef<HangulResult>('finished'); // 저장 실패 뒤 '다시 하기'도 같은 결과(finished/skipped)로
  // five(스위치 + 서버 지원): ②에서 고른 낱말을 쓴다(넘긴 날은 사진 낱말 그대로). 번호 4/5, 넘어가기는 p_skipped. 아니면 사진 낱말·3/3 그대로
  const {content, done, picks, five} = useSession();
  const n = stepNumber('hangul', five);
  const {fontScale, height: winH} = useWindowDimensions();
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
  // 보기 판(사진 + AI 고지 + 따라 쓸 낱말)과 쓰기 칸(안내 + 입력 칸)을 나눈다(오너 S25 11-25, 회의록 docs/design/2026-11-25-p6-clarity).
  // 사진은 원본 비율 그대로(P4 photoFrame) — 옛 고정 높이 56 띠 + cover 는 단풍 숲길을 가는 띠로 잘랐다.
  // 사진 높이 = 입력 칸까지 첫 화면에 드는 높이(fit). fit 이 바닥(P6_PHOTO_MIN_H)보다 작으면 사진을 접는다(#104 ② — 입력 칸이 먼저).
  // fit 은 사진 높이·유무와 무관한 실측값(보기 판 위 끝·고지·낱말·쓰기 칸 높이)으로만 계산해 측정 → 줄임 → 재측정 반복이 없다
  const [viewport, setViewport] = useState(0);
  const [cardBox, setCardBox] = useState<{y: number; h: number} | null>(null); // 자연 위치(넣은 여백 뺀 값)
  const [lookBox, setLookBox] = useState<{y: number; w: number} | null>(null);
  const [noticeH, setNoticeH] = useState<number | undefined>(undefined);
  const [modelH, setModelH] = useState<number | undefined>(undefined);
  const {aspect, failed: photoFailed, onLoad: onPhotoLoad, onError: onPhotoError} = usePhotoLoad(content?.photo?.image_url);
  const [readH, setReadH] = useState<number | undefined>(undefined);
  const [doneBox, setDoneBox] = useState<{y: number; h: number} | null>(null);
  const [romanH, setRomanH] = useState<number | undefined>(undefined);
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
  const recallWord = five ? recallWordOf(content, picks) : null;
  const word = recallWord ?? photo.keyword;
  const cells = syllables(word);
  if (review) {
    const hasImage = !photo.image_url.startsWith('pending://') && !imageFailed;
    return (
      <Screen
        top={
          <>
            <BackBar course onBack={toCourseHome} />
            <StepHeader name={copy.course.step.hangul} n={n} review five={five} />
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
              <Text20 style={styles.figcaption}>{`${appCopy.ai_photo_label}·${appCopy.not_real_place}`}</Text20>
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
  // 리뷰 L3: 낱말 자체에 영문이 있는 날(예 'TV')에는 켜지 않는다
  const roman = phase === 'writing' && !/[A-Za-z]/.test(word) && /[A-Za-z]/.test(text);
  const cardBottom = cardBox ? cardBox.y + cardBox.h : 0;
  // 보기 판은 닫힘·다시 써 보기 대화상자 동안(일치 뒤·자판 열림에는 없음)
  const showLook = !open && phase !== 'matched';
  const fit = p6PhotoFit({viewport, lookTop: lookBox?.y, notice: noticeH ?? noticeGuess(lookBox?.w, fontScale), model: modelH, card: cardBox?.h});
  const hasImage = !photo.image_url.startsWith('pending://') && !photoFailed;
  const showPhoto = showLook && hasImage && fit !== undefined && fit >= P6_PHOTO_MIN_H && !!lookBox;
  const frame = showPhoto && lookBox ? photoFrame(lookBox.w, aspect, winH, fit, P6_PHOTO_MIN_H) : null;
  // R-15: 닫힘에서 쓰기 칸(안내 + 입력 칸)이 첫 화면 끝에 걸치면 통째로 아래로(200% — 시안 '닫힘 200% 입력칸은 스크롤로 닿음')
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
    // 다 마친 뒤 홈에서 다시 연 경우(5단계 '여기까지'로 넘긴 ④ 다시 하기)는 P7 을 다시 보이지 않는다
    const wasAll = five && allStepsDone(done, five);
    const willFinishCourse = !wasAll && courseStepNames(five).every(s => s === 'hangul' || done.includes(s));
    if (await finish('hangul', {hangul: {attemptNo: attempts, result}, skipped: result === 'skipped'})) {
      if (willFinishCourse) {
        navigation.replace('CourseDone'); // P7: 알겠어요 → 코스 홈
      } else {
        navigation.popTo('CourseHome');
      }
    }
  };
  const skip = () => complete('skipped');
  // AI 고지(리드 결정 11-20, #95 최종·법무 체크리스트): 사진이 나오는 곳은 'AI가 만든 그림·실제 장소가 아니에요' 한 줄로 일관되게(가운뎃점 둘레 공백 없음, Noto 재렌더 #162)
  const aiNotice = `${appCopy.ai_photo_label}·${appCopy.not_real_place}`;

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
          // 「한 글자라도 쓰면 눌려요」는 본문 안내가 아니라 버튼 상태 설명 → 꺼진 버튼 바로 위 이유 줄 + 힌트(P5 need_choice 와 같은 꼴).
          // 자판 열림에서는 이유 줄을 그리지 않고 힌트만: 자판 위 Dock 이 한 줄만큼 커져 [낱말][입력 칸] 줄이 '더 있음' 띠에 가렸다(에뮬레이터 360×640 실측)
          primary: open
            ? {label: copy.course.next.hangul, buttonRef: doneRef, disabled: !hasText, accessibilityHint: hasText ? undefined : k.need_one, loading: busy, onPress: pressDone}
            : {label: copy.course.next.hangul, buttonRef: doneRef, disabled: !hasText, disabledReason: k.need_one, loading: busy, onPress: pressDone},
          // 닫힘: 넘어가기는 Dock(넘치면 본문 끝으로, R-12). 자판 열림은 위 줄(100%) 또는 본문(200%)
          secondary: open ? undefined : skipStrong ? {kind: 'secondary', label: k.skip, disabled: busy, testID: 'kb-skip-strong', onPress: skip} : {kind: 'text', label: k.skip, disabled: busy, onPress: skip},
        };
  // 리드 결정(b, 11-20, 시안 변경): 200% 자판 열림에서는 Dock 을 풀고 '다 썼어요'를 입력 칸 바로 아래 본문에. 보이는 창(약 75dp)이 모자라
  //   카드가 '더 있음' 띠에 가렸다(에뮬레이터 실측). 자판이 닫히면 Dock 으로 돌아온다
  const releaseDock = open && large && !error;
  // #192 리뷰 L1: 200% 자판 열림에서 '다 썼어요' 아래 영문 안내 줄이 자판 경계(첫 화면 끝)에 걸치면 통째로 아래로(R-15, foldPush)
  const romanBase = doneBox ? doneBox.y + doneBox.h + BODY_GAP : 0;
  const romanPush = releaseDock && roman && doneBox ? foldPush(viewport, romanBase, [romanH], 0, true) : null;
  const asideSkip = open && !large ? <Button kind="text" size="inline" label={k.skip_short} accessibilityHint={k.skip} disabled={busy} onPress={skip} testID="kb-skip-top" /> : undefined;

  return (
    <DsScreen
      variant="step"
      back={{to: copy.course.to_home, onPress: toCourseHome}}
      backAside={asideSkip}
      header={<StepHeader name={copy.course.step.hangul} n={n} five={five} />}
      stepInfo={stepA11y(copy.course.step.hangul, n, false, five)}
      onViewport={setViewport}
      dock={releaseDock ? undefined : dock}>
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
      ) : showLook ? (
        // 보기 판: 옅은 종이 면(테두리 없음) = 보는 곳. 테두리 상자는 쓰는 곳(입력 칸) 하나뿐이다
        <View
          testID="kb-look"
          style={styles.look}
          onLayout={e => {
            const {y, width} = e.nativeEvent.layout;
            const next = {y: Math.round(y), w: Math.round(width)};
            setLookBox(b => (b && b.y === next.y && b.w === next.w ? b : next));
          }}>
          {showPhoto && frame ? (
            <>
              <View testID="kb-photo" style={[styles.photo, frame]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {/* 틀이 사진 비율과 같아 잘리지 않는다(비율을 알기 전 콘텐츠 비율 틀에서도 잘라 내지 않게 contain — P4 와 같음) */}
                <Image testID="kb-photo-image" source={{uri: photo.image_url}} style={styles.photoImg} resizeMode="contain" onLoad={onPhotoLoad} onError={onPhotoError} />
              </View>
              <View testID="kb-ai-notice-wrap" style={styles.lookNotice} onLayout={e => setNoticeH(Math.ceil(e.nativeEvent.layout.height))}>
                <AiNotice testID="kb-ai-notice" text={aiNotice} />
              </View>
            </>
          ) : null}
          <View testID="kb-model" accessible accessibilityLabel={k.word_a11y.split('{낱말}').join(word)} onLayout={e => setModelH(Math.ceil(e.nativeEvent.layout.height))}>
            <WordLine word={word} />
          </View>
        </View>
      ) : null}
      {/* 입력칸은 상태와 관계없이 같은 자리에 둔다(다시 그려지면 비제어 입력이 지워짐). 일치 뒤에는 숨기기만 */}
      <View
        testID="kb-card"
        onLayout={e => {
          const {y, height} = e.nativeEvent.layout;
          const natural = {y: Math.round(y - (cardPushRef.current ?? 0)), h: Math.ceil(height)};
          setCardBox(b => (b && Math.abs(b.y - natural.y) < 1 && b.h === natural.h ? b : natural));
        }}
        // 자판 열림: 본보기 낱말과 입력 칸을 한 줄로(실측 360×640 Gboard: 보이는 본문 약 75dp — 위아래로 두면 시스템이 입력 칸을 보이게 스크롤해 낱말이 잘렸다, r1/7 H)
        style={[styles.write, open ? styles.writeOpen : null, cardPush ? {marginTop: cardPush.space} : null, phase === 'matched' ? styles.hidden : null]}>
        {open ? (
          <View accessible accessibilityLabel={k.word_a11y.split('{낱말}').join(word)}>
            <WordLine word={word} />
          </View>
        ) : null}
        {/* 닫힘: 안내가 입력 칸의 보이는 이름표(바로 위 한 줄). 버튼 상태 설명(need_one)은 Dock '다 썼어요' 위 이유 줄로 옮겼다 */}
        {showLook ? (
          <Text testID="kb-guide" role="body">
            {recallWord ? k.guide_recall : k.guide}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          testID="kb-input"
          accessibilityLabel={k.input_label}
          // #265 QA-2 L1: 힌트에 따라 쓸 낱말(라벨은 그대로). 조사를 정할 수 없으면(영문 낱말) 옛 힌트
          accessibilityHint={fillObject(k.input_hint, '낱말', word) ?? k.placeholder}
          onChangeText={onChangeText}
          onFocus={() => setKbOpen(true)}
          onBlur={() => setKbOpen(false)}
          editable={phase === 'writing'}
          importantForAutofill="no" // 자동완성 서비스가 글자 저장을 제안하지 않게(정책: 글자 미저장)
          // autoCorrect 는 지정하지 않는다: Android 에서 false 는 추천 줄까지 꺼서 "기기 설정 그대로"와 어긋남(리뷰 B).
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit
          // 자판 '완료' 키 = '다 썼어요'(한 글자 이상일 때). 리드 결정(b) 확인 항목
          onSubmitEditing={() => {
            if (hasText && !busy) {
              pressDone();
            }
          }}
          maxFontSizeMultiplier={ds.type.fieldInput.maxFontScale}
          style={[styles.input, open ? styles.inputOpen : null, inputText, kbOpen ? styles.inputFocused : null]}
        />
      </View>
      {releaseDock ? (
        <View
          testID="kb-done-inline"
          onLayout={e => {
            const {y, height} = e.nativeEvent.layout;
            const next = {y: Math.round(y), h: Math.ceil(height)};
            setDoneBox(b => (b && b.y === next.y && b.h === next.h ? b : next));
          }}>
          {/* 이유 줄은 그리지 않고 힌트만(100% 자판 열림과 같음): 320×640 200%에서 두 줄 이유가 '다 썼어요'를 '더 있음' 띠 아래로 밀었다(에뮬레이터 실측 11-25) */}
          <Button label={copy.course.next.hangul} buttonRef={doneRef} disabled={!hasText} accessibilityHint={hasText ? undefined : k.need_one} loading={busy} onPress={pressDone} />
        </View>
      ) : null}
      {roman ? (
        <View testID="kb-roman-wrap" onLayout={e => setRomanH(Math.ceil(e.nativeEvent.layout.height))} style={romanPush ? {marginTop: romanPush.space} : undefined}>
          <Text testID="kb-roman" role="sub">{k.roman_hint}</Text>
        </View>
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
/** 보기 판 위아래 여백·묶음 간격. 좌우 여백은 0 — AI 고지가 본문 폭(360 → 312)에서 한 줄(P4와 같음, #162). 판 안쪽 12를 두면 두 줄로 꺾여
 *  360×780(오너 S25 근사)에서 사진 fit 이 바닥 아래로 떨어져 사진이 접혔다(에뮬레이터 실측) */
export const LOOK_PAD = 12;
export const LOOK_GAP = 8;
/** 시각 여유(#265 QA-2 M1): 입력 칸 아래 테두리와 '더 있음' 띠 사이가 눈으로도 떨어져 보이게(실측 여유 2.5dp는 붙어 보여 '잘림'으로 읽힘) */
export const P6_FIT_GAP = 12;
/** 사진 바닥: 이보다 낮게 줄여야 입력 칸이 첫 화면에 들면 사진을 접는다(② 떠올려 보기 썸네일 64보다 크게, 가로 약 2.5:1 띠보다 덜 납작하게) */
export const P6_PHOTO_MIN_H = 96;
/** AI 고지 한 줄 높이(label 역할 줄높이)와 글 폭(P4 360 폭 실측 약 305dp, 확대 상한 1.5 — AiNotice) */
const NOTICE_LINE = Number(roleText('label', 'elder').style.lineHeight ?? 30);
const NOTICE_TEXT_W = 306;
/** 고지는 사진이 있을 때만 그려 사진 전에는 잴 수 없다 → 판 폭으로 줄 수를 어림(그린 뒤에는 실측). 실측이 더 크면 사진이 접힐 뿐 다시 펴지지 않는다(실측값 유지) */
export function noticeGuess(width: number | undefined, fontScale: number): number {
  const scale = Math.min(fontScale, 1.5);
  const lines = width && width > 0 ? Math.max(1, Math.ceil((NOTICE_TEXT_W * scale) / width)) : 2;
  return Math.ceil(NOTICE_LINE * scale * lines);
}

/**
 * P6 사진 fit: 보기 판(사진 → 고지 → 따라 쓸 낱말) + 간격 + 쓰기 칸(안내 + 입력 칸)이 첫 화면(viewport)에 드는 사진 높이.
 * 모두 사진 높이·유무와 무관한 실측값이라 사진을 줄이거나 접어도 다시 바뀌지 않는다. 하나라도 못 쟀으면 undefined(사진 아직 안 그림).
 */
export function p6PhotoFit(m: {viewport: number; lookTop?: number; notice: number; model?: number; card?: number}): number | undefined {
  if (!(m.viewport > 0) || m.lookTop === undefined || m.model === undefined || m.card === undefined) {
    return undefined;
  }
  return m.viewport - m.lookTop - LOOK_PAD - LOOK_GAP - m.notice - LOOK_GAP - m.model - LOOK_PAD - BODY_GAP - m.card - PHOTO_FIT_SLACK - P6_FIT_GAP;
}

const styles = StyleSheet.create({
  // 회의 결정(11-25): 보기 판 = 옅은 종이 면(paperSoft, 테두리 없음 — 면 규칙 '종이 = 안내·보는 것'), 쓰기 칸 = 흰 면 + 굵은 테두리 입력 칸 하나
  look: {backgroundColor: ds.color.paperSoft, borderRadius: ds.radius.card, paddingVertical: LOOK_PAD, gap: LOOK_GAP, alignItems: 'center'},
  photo: {borderRadius: ds.radius.card, overflow: 'hidden', backgroundColor: ds.color.paperEdge},
  photoImg: {flex: 1, alignSelf: 'stretch'},
  lookNotice: {alignSelf: 'stretch', alignItems: 'center'},
  write: {gap: ds.space.group},
  // 리뷰 M2: 3음절 낱말(라디오) + 200%(글자 51)에서도 한 줄 — 320 폭 본문 272 = 낱말 약 153 + 간격 8 + 입력 칸 96 이상
  // 자판 열림: 보이는 본문이 약 75dp(360×640 Gboard) — 줄높이를 뺀 입력 칸(글자 51 + 위아래)이 들어가게 위아래 여백 없음
  writeOpen: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8},
  inputOpen: {flexGrow: 1, flexBasis: 96, paddingHorizontal: 10, paddingVertical: 0},
  matchedGroup: {gap: 20},
  matchedHead: {flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap'},
  writtenCard: {backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, paddingVertical: 14, paddingHorizontal: 18, gap: 6},
  title: {color: color.inkTitle},
  card: {backgroundColor: color.card, borderRadius: radius.card, padding: 14, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 18},
  figure: {alignItems: 'center', gap: 2},
  thumb: {width: 96, backgroundColor: color.card, paddingTop: 5, paddingHorizontal: 5, paddingBottom: 12, boxShadow: shadow.soft, transform: [{rotate: '-2deg'}]},
  thumbImg: {width: 86, height: 75, backgroundColor: color.paperSoft},
  figcaption: {color: color.inkBody, fontSize: 20},
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
  // 화면에 하나뿐인 테두리 상자 = 쓰는 곳. 굵기 2(옛 1.5 — 카드 테두리와 같아 구분이 안 됐다), 열리면 action 3
  input: {minHeight: 56, paddingHorizontal: 16, paddingVertical: 4, backgroundColor: ds.color.card, borderRadius: ds.radius.input, borderWidth: 2, borderColor: ds.color.line},
  inputFocused: {borderWidth: 3, borderColor: ds.color.action},
  sub: {color: color.inkBody},
  matched: {alignItems: 'center', gap: 8, paddingVertical: 8},
  matchedIcon: {width: 64, height: 64, borderRadius: 32, backgroundColor: color.doneSoft, alignItems: 'center', justifyContent: 'center'},
});
