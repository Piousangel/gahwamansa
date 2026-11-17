import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, FONT_SCALE_MAX, radius, shadow} from '../../ui/tokens';
import {Icon} from '../../ui/assets/icons';
import {useSession} from '../../app/session';
import {appCopy, copy} from '../../copy/copy';
import {TextLink} from '../link/TextLink';
import {StepError} from './StepError';
import {useFinishStep} from './useFinishStep';
import {filledCount, isMatch, normalizeWord, syllables} from './keyboardMatch';
import type {StepName} from '../types';

const k = copy.keyboard;
const STEP_ORDER: StepName[] = ['photo', 'question', 'hangul'];
const STEP_NO = `${STEP_ORDER.indexOf('hangul') + 1} / ${STEP_ORDER.length}`;
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
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('writing');
  const [attempts, setAttempts] = useState(0); // "다 썼어요"를 누른 수(이벤트 attempts 정의)
  const [canFinish, setCanFinish] = useState(false);
  const [lateSkip, setLateSkip] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

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
    return () => clearTimeout(t);
  }, [phase]);

  const photo = content?.photo;
  if (!photo) {
    return null;
  }
  const word = photo.keyword;
  const cells = syllables(word);
  const filled = phase === 'matched' ? cells.length : filledCount(text, word);
  const hasText = normalizeWord(text).length > 0;
  const skipStrong = attempts >= 2 || lateSkip;
  const open = kbOpen && phase === 'writing';
  const hideTitle = open && fontScale >= 1.5; // 리드 결정: 150% 이상 + 자판 열림일 때만
  const showPhoto = !open && !photo.image_url.startsWith('pending://') && !imageFailed;

  const matched = () => {
    Keyboard.dismiss(); // 칭찬이 자판에 가려지지 않게 먼저 내린다
    setKbOpen(false);
    setPhase('matched');
    AccessibilityInfo.announceForAccessibility(k.matched);
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
  // TODO(이벤트 0022): hangul_done {matched, attempts, skipped} 만 보낸다(글자 내용 금지). events RPC 가 생기면 연결.
  // 마치기·이대로 마칠게요·넘어갈게요는 모두 같은 "단계 완료" 기록이다(평가하지 않음).
  const complete = async () => {
    setPhase(p => (p === 'sheet' ? 'writing' : p));
    const willFinishCourse = STEP_ORDER.every(s => s === 'hangul' || done.includes(s));
    if (await finish('hangul')) {
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
    <BigButton label={k.finish} disabled={!canFinish} loading={busy} onPress={complete} />
  ) : (
    <>
      <BigButton
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
        <TextLink label={k.skip} touch={64} disabled={busy} onPress={complete} />
      )}
    </>
  );

  return (
    <Screen
      top={
        <>
          <BackBar course onBack={toCourseHome} />
          {hideTitle ? null : (
            <View style={styles.titleRow}>
              <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{copy.course.step.hangul}</Text20>
              <Text20 weight="bold" style={styles.stepNo}>{STEP_NO}</Text20>
            </View>
          )}
        </>
      }
      bottom={dock}>
      {open || phase === 'matched' ? null : <Text20 size={22} weight="bold" style={styles.title}>{k.guide}</Text20>}
      <View style={styles.card}>
        {showPhoto ? (
          <View style={styles.figure}>
            <View style={styles.thumb} accessible accessibilityRole="image" accessibilityLabel={k.photo_a11y}>
              <Image source={{uri: photo.image_url}} style={styles.thumbImg} onError={() => setImageFailed(true)} />
            </View>
            <Text20 style={styles.figcaption}>{appCopy.ai_photo_label}</Text20>
          </View>
        ) : null}
        <WordCells cells={cells} filled={filled} big={!open} />
        {/* TODO(읽어주기): 시안의 '읽어 주세요' 버튼은 읽어주기(TTS) 작업에서 붙인다 */}
      </View>
      {/* 입력칸은 상태와 관계없이 같은 자리에 둔다(다시 그려지면 비제어 입력이 지워짐). 일치 뒤에는 숨기기만 */}
      <View style={phase === 'matched' && !error ? styles.hidden : styles.inputWrap}>
        {open ? null : <Text20 size={20} weight="bold" style={styles.title}>{k.input_label}</Text20>}
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
          // autoCorrect 는 지정하지 않는다: Android 에서 false 는 추천 줄까지 꺼서 "기기 설정 그대로"와 어긋남(리뷰 B).
          // TODO(QA 실기기): 삼성 천지인·두벌식·Gboard 에서 추천 낱말·자동 띄어쓰기·조합 깨짐 확인
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit
          maxFontSizeMultiplier={FONT_SCALE_MAX}
          style={[styles.input, kbOpen ? styles.inputFocused : null]}
        />
      </View>
      {phase === 'matched' ? (
        <View style={styles.matched} accessibilityLiveRegion="polite">
          <View style={styles.matchedIcon}>
            <Icon name="icon-check" size={36} color={color.done} />
          </View>
          <Text20 size={32} weight="bold" style={styles.title}>{k.matched}</Text20>
        </View>
      ) : open ? null : (
        <Text20 style={styles.sub}>{k.sub}</Text20>
      )}
      <RetrySheet
        visible={phase === 'sheet'}
        cells={cells}
        filled={filled}
        written={normalizeWord(text)}
        onRetry={retry}
        onFinish={complete}
      />
    </Screen>
  );
}

// 낱말 카드: 음절 칸. 맞게 쓴 칸만 하늘색 + 확인 표시. 다른 칸은 빈 점선 칸 그대로(틀림 표시 없음).
// 화면 읽기는 카드 한 덩어리로("쓸 낱말, 나무, 두 글자 …"). 칸 변화는 읽지 않는다(소음).
function WordCells({cells, filled, big}: {cells: string[]; filled: number; big: boolean}) {
  const word = cells.join('');
  const count = k.count_words[cells.length - 1] ?? String(cells.length);
  const label = k.card_a11y.split('{낱말}').join(word).split('{n}').join(count);
  const side = big ? 64 : 52;
  return (
    <View style={styles.cells} accessible accessibilityRole="image" accessibilityLabel={label}>
      {cells.map((ch, i) => {
        const on = i < filled;
        return (
          <View key={`${ch}-${i}`} testID={`kb-cell-${i}`} style={[styles.cell, {width: side, height: side}, on ? styles.cellOn : null]}>
            <Text20 size={big ? 40 : 32} weight="bold" maxFontSizeMultiplier={1} style={styles.title}>{ch}</Text20>
            {on ? (
              <View testID={`kb-cell-check-${i}`} style={styles.badge}>
                <Icon name="icon-check" size={14} color={color.onAction} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// "다 썼어요"를 다른 낱말로 눌렀을 때의 아래 시트. 바깥·뒤로가기는 "다시 써 볼게요"와 같다.
// TODO(공용 시트): 다른 줄이 만드는 공용 BottomSheet 가 나오면 교체.
function RetrySheet({visible, cells, filled, written, onRetry, onFinish}: {
  visible: boolean; cells: string[]; filled: number; written: string; onRetry: () => void; onFinish: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRetry} statusBarTranslucent>
      <View style={styles.scrimWrap}>
        <Pressable style={styles.scrim} onPress={onRetry} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grip} />
          {/* 글자 200%에서도 버튼까지 닿게 시트 안에서 스크롤 */}
          <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
            <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{k.sheet_title}</Text20>
            <View style={styles.sheetCard}>
              <WordCells cells={cells} filled={filled} big />
              <View style={styles.written}>
                <Text20>{k.your_word}</Text20>
                <Text20 size={28} weight="bold" style={styles.title}>{written}</Text20>
              </View>
            </View>
            <BigButton label={k.retry} onPress={onRetry} />
            <BigButton variant="secondary" label={k.finish_as_is} onPress={onFinish} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  titleRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, paddingBottom: 8},
  title: {color: color.inkTitle},
  stepNo: {color: color.ink},
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
  hidden: {display: 'none'},
  // 입력칸(오목): 종이색 면 + 아래 밑줄, 높이 72 이상, 글자 34
  input: {minHeight: 72, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: color.paperSoft, borderTopLeftRadius: radius.input, borderTopRightRadius: radius.input, borderBottomWidth: 3, borderBottomColor: color.line, fontSize: 34, color: color.inkTitle, fontWeight: 'bold'},
  inputFocused: {borderBottomWidth: 4, borderBottomColor: color.action},
  sub: {color: color.ink},
  matched: {alignItems: 'center', gap: 8, paddingVertical: 8},
  matchedIcon: {width: 64, height: 64, borderRadius: 32, backgroundColor: color.doneSoft, alignItems: 'center', justifyContent: 'center'},
  scrimWrap: {flex: 1, justifyContent: 'flex-end'},
  scrim: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(78,47,20,0.58)'},
  sheet: {maxHeight: '88%', backgroundColor: color.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 28},
  sheetBody: {gap: 8},
  grip: {alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.lineGhost, marginBottom: 4},
  sheetCard: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 12},
  written: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', columnGap: 8},
});
