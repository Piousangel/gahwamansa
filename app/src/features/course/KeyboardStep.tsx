import React, {useEffect, useRef, useState} from 'react';
import {Image, Keyboard, Pressable, StyleSheet, TextInput, useWindowDimensions, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, FONT_SCALE_MAX, radius, shadow} from '../../ui/tokens';
import {Dialog} from '../../ui/Dialog';
import {announce, useScreenReader} from '../../ui/a11y';
import {focusLater} from '../../ui/screenTitle';
import {Icon} from '../../ui/assets/icons';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {StepError} from './StepError';
import {useFinishStep} from './useFinishStep';
import {StepHeader} from './StepHeader';
import {confirmedCount, filledCount, isMatch, normalizeWord, syllables} from './keyboardMatch';
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
export function KeyboardStep({navigation}: NativeStackScreenProps<ParentParams, 'KeyboardStep'>) {
  const toCourseHome = () => navigation.popTo('CourseHome');
  const {finish, error, busy} = useFinishStep();
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
  const filled = phase === 'matched' ? cells.length : filledCount(text, word);
  const hasText = normalizeWord(text).length > 0;
  const skipStrong = reader || attempts >= 2 || lateSkip;
  const open = kbOpen && phase === 'writing';
  const hideTitle = open && fontScale >= 1.5; // 리드 결정: 150% 이상 + 자판 열림일 때만
  const showPhoto = !open && !photo.image_url.startsWith('pending://') && !imageFailed;

  const matched = () => {
    Keyboard.dismiss(); // 칭찬이 자판에 가려지지 않게 먼저 내린다
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
  // 계측: useFinishStep 이 course_step_completed {step:'hangul', duration_sec, attempt_no}를 보낸다(0022).
  //   서버 result 값은 granted·denied 뿐이라 일치·이대로·넘어가기 구분은 싣지 않는다. 글자 내용은 절대 보내지 않는다.
  // 마치기·이대로 마칠게요·넘어갈게요는 모두 같은 "단계 완료" 기록이다(평가하지 않음).
  const complete = async () => {
    setPhase(p => (p === 'sheet' ? 'writing' : p));
    const willFinishCourse = STEP_ORDER.every(s => s === 'hangul' || done.includes(s));
    if (await finish('hangul', attempts)) {
      if (willFinishCourse) {
        navigation.replace('CourseDone'); // P7: 알겠어요 → 코스 홈
      } else {
        navigation.popTo('CourseHome');
      }
    }
  };

  const dock = error ? (
    <StepError error={error} onRetry={complete} />
  ) : phase === 'matched' ? (
    <BigButton buttonRef={finishRef} label={k.finish} disabled={!canFinish} loading={busy} onPress={complete} />
  ) : (
    <>
      <BigButton
        buttonRef={doneRef}
        label={copy.course.next.hangul}
        disabled={!hasText}
        disabledReason={open ? undefined : k.need_one}
        loading={busy}
        onPress={pressDone}
      />
      {open ? null : skipStrong ? (
        <View testID="kb-skip-strong">
          <BigButton variant="secondary" label={k.skip} disabled={busy} onPress={complete} />
        </View>
      ) : (
        <SkipLink label={k.skip} disabled={busy} onPress={complete} />
      )}
    </>
  );

  return (
    <Screen
      top={
        <>
          <BackBar course onBack={toCourseHome} />
          {/* 제목 포커스(R2)는 StepHeader 가 Screen 에 등록한다. 150% 이상 + 자판 열림이면 숨김(리드 결정) */}
          {hideTitle ? null : <StepHeader name={copy.course.step.hangul} n={3} />}
        </>
      }
      bottom={dock}>
      {open || phase === 'matched' ? null : <Text20 size={22} weight="bold" style={styles.title}>{k.guide}</Text20>}
      <View style={styles.card}>
        {showPhoto ? (
          // 명세 P6 4번: 카드(사진+칸)는 한 덩어리로 읽는다 → 사진은 읽기에서 빼고 칸 묶음 라벨이 대표
          <View style={styles.figure} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.thumb}>
              <Image source={{uri: photo.image_url}} style={styles.thumbImg} onError={() => setImageFailed(true)} />
            </View>
            <Text20 style={styles.figcaption}>{appCopy.ai_photo_label}</Text20>
          </View>
        ) : null}
        <WordCells cells={cells} filled={filled} big={!open} />
        {/* TODO(읽어주기): 오디오 스파이크 결론 뒤 '읽어 주세요'(글자 버튼, 화면 읽기 켜짐이면 숨김 R16)를 이 자리에 */}
      </View>
      {/* 입력칸은 상태와 관계없이 같은 자리에 둔다(다시 그려지면 비제어 입력이 지워짐). 일치 뒤에는 숨기기만 */}
      <View style={phase === 'matched' ? styles.hidden : styles.inputWrap}>
        {/* 보이는 이름표는 입력칸 라벨과 같아 두 번 읽지 않게 숨김 */}
        {open ? null : (
          <Text20 size={20} weight="bold" style={styles.title} accessibilityElementsHidden importantForAccessibility="no">
            {k.input_label}
          </Text20>
        )}
        <TextInput
          ref={inputRef}
          testID="kb-input"
          accessibilityLabel={k.input_label}
          placeholder={k.placeholder}
          placeholderTextColor={color.inkSub}
          onChangeText={onChangeText}
          onFocus={() => setKbOpen(true)}
          onBlur={() => setKbOpen(false)}
          editable={phase === 'writing'}
          importantForAutofill="no" // 자동완성 서비스가 글자 저장을 제안하지 않게(정책: 글자 미저장)
          // autoCorrect 는 지정하지 않는다: Android 에서 false 는 추천 줄까지 꺼서 "기기 설정 그대로"와 어긋남(리뷰 B).
          // TODO(QA 실기기): 삼성 천지인·두벌식·Gboard 에서 추천 낱말·자동 띄어쓰기·조합 깨짐 확인
          // TODO(QA 실기기): 입력칸은 본문 자리 그대로(자판 위로 옮기면 다시 그려져 비제어 입력이 지워짐).
          //   320×640·글자 200%·천지인(자판 높음)에서 자판 열림 때 입력칸·다 썼어요가 가리지 않는지 확인(디자인 대조 1번)
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit
          maxFontSizeMultiplier={FONT_SCALE_MAX}
          style={[styles.input, kbOpen ? styles.inputFocused : null]}
        />
      </View>
      {phase === 'matched' ? (
        // 알림은 announceForAccessibility 1회만(R11). liveRegion 을 같이 두면 두 번 읽힌다
        <View style={styles.matched}>
          <View style={styles.matchedIcon}>
            <Icon name="icon-check" size={36} color={color.done} />
          </View>
          <Text20 size={32} weight="bold" style={styles.title}>{k.matched}</Text20>
        </View>
      ) : open ? null : (
        <Text20 style={styles.sub}>{k.sub}</Text20>
      )}
      {/* 다른 낱말로 "다 썼어요": 어르신 대화상자(U0 Dialog, 어르신은 아래 시트 대신 Dialog). 뒤로가기 = 다시 써 볼게요 */}
      <Dialog
        visible={phase === 'sheet'}
        title={k.sheet_title}
        body={`${k.your_word} ${normalizeWord(text)}`}
        returnFocusRef={doneRef} // R12: 닫히면 연 버튼('다 썼어요')으로
        actions={[
          {label: k.retry, onPress: retry},
          {label: k.finish_as_is, onPress: complete},
        ]}
        onBack={retry}
        testID="kb-retry">
        {/* 확정된 칸만 채운다(받침 유지로 잠깐 찬 칸은 빼고, 재검토). 틀림 표시 없음 */}
        <WordCells cells={cells} filled={confirmedCount(text, word)} big idPrefix="kb-dialog-cell" />
      </Dialog>
    </Screen>
  );
}

// 낱말 카드: 음절 칸. 맞게 쓴 칸만 하늘색 + 확인 표시. 다른 칸은 빈 점선 칸 그대로(틀림 표시 없음).
// 화면 읽기는 카드 한 덩어리로("쓸 낱말, 나무, 두 글자 …"). 칸 변화는 읽지 않는다(소음).
function WordCells({cells, filled, big, idPrefix = 'kb-cell'}: {cells: string[]; filled: number; big: boolean; idPrefix?: string}) {
  const word = cells.join('');
  const count = k.count_words[cells.length - 1] ?? String(cells.length);
  const label = k.card_a11y.split('{낱말}').join(word).split('{n}').join(count);
  const side = big ? 64 : 52;
  return (
    <View style={styles.cells} accessible accessibilityRole="image" accessibilityLabel={label}>
      {cells.map((ch, i) => {
        const on = i < filled;
        return (
          <View key={`${ch}-${i}`} testID={`${idPrefix}-${i}`} style={[styles.cell, {width: side, height: side}, on ? styles.cellOn : null]}>
            <Text20 size={big ? 40 : 32} weight="bold" maxFontSizeMultiplier={1} style={styles.title}>{ch}</Text20>
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

// 약한 넘어가기 링크(글자 20·밑줄·터치 64). 기능 간 import 금지라 link/TextLink 대신 최소판.
// TODO(ui/TextLink): 리팩터 줄이 TextLink 를 ui/ 로 올리면 교체.
function SkipLink({label, disabled, onPress}: {label: string; disabled?: boolean; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={styles.skipLink}>
      <Text20 weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.skipText}>{label}</Text20>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle},
  card: {backgroundColor: color.card, borderRadius: radius.card, padding: 14, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 18},
  figure: {alignItems: 'center', gap: 2},
  thumb: {width: 96, backgroundColor: color.card, paddingTop: 5, paddingHorizontal: 5, paddingBottom: 12, boxShadow: shadow.soft, transform: [{rotate: '-2deg'}]},
  thumbImg: {width: 86, height: 75, backgroundColor: color.paperSoft},
  figcaption: {color: color.ink, fontSize: 20},
  cells: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center'},
  cell: {borderRadius: 14, borderWidth: 3, borderStyle: 'dashed', borderColor: color.line, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center'},
  cellOn: {backgroundColor: color.sky, borderStyle: 'solid', borderColor: color.action},
  badge: {position: 'absolute', right: -7, top: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: color.action, alignItems: 'center', justifyContent: 'center'},
  inputWrap: {gap: 6},
  skipLink: {minHeight: 64, alignItems: 'center', justifyContent: 'center'},
  skipText: {textDecorationLine: 'underline', color: color.ink},
  hidden: {display: 'none'},
  // 입력칸(오목): 종이색 면 + 아래 밑줄, 높이 72 이상, 글자 34
  input: {minHeight: 72, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: color.paperSoft, borderTopLeftRadius: radius.input, borderTopRightRadius: radius.input, borderBottomWidth: 3, borderBottomColor: color.line, fontSize: 34, color: color.inkTitle, fontWeight: 'bold'},
  inputFocused: {borderBottomWidth: 4, borderBottomColor: color.action},
  sub: {color: color.ink},
  matched: {alignItems: 'center', gap: 8, paddingVertical: 8},
  matchedIcon: {width: 64, height: 64, borderRadius: 32, backgroundColor: color.doneSoft, alignItems: 'center', justifyContent: 'center'},
});
