import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {StepRow} from '../../ui/StepRow';
import {color, FONT_SCALE_MAX, radius, size} from '../../ui/tokens';
import {Icon} from '../../ui/assets/icons';
import {useScreenTitleRef} from '../../ui/screenTitle';
import {appCopy, copy} from '../../copy/copy';
import {useLoadTodayContent} from './useTodayContent';
import {StampRow} from './StampRow';
import {CheerDialog} from './CheerDialog';
import {kstDateLine, kstWeekdayIndex, stampsFromDates} from './stamps';
import {useWeekStamps} from './useWeekStamps';
import {Stitch} from '../../ui/assets/album';
import {TextLink} from '../link/TextLink';
import {useBootLoading} from '../../app/splash';
import type {StepName} from '../types';

const c = copy.course;
type StepRoute = 'PhotoStep' | 'QuestionStep' | 'KeyboardStep';
const STEPS: {step: StepName; route: StepRoute}[] = [
  {step: 'photo', route: 'PhotoStep'},
  {step: 'question', route: 'QuestionStep'},
  {step: 'hangul', route: 'KeyboardStep'},
];

// P3 코스 홈(동결 시안 P3_course_home_v4).
// - 위 고정 영역 없음: 날짜 줄·설정·띠·스티치까지 모두 본문(스크롤) 안(리뷰 H3). 날짜 줄이 화면 제목(머리글, R2 첫 포커스·P8 닫힌 뒤 복귀).
// - 간격 3단계(리듬 D): 묶음 안 8, 묶음 사이 16(본문 gap), 구역 사이 24(날짜 묶음 → 스티치 → 인사 묶음 → 단계).
// - 하단: 지금 단계 이름(주 버튼). 다 마치면 보조 '오늘 코스 다시 보기'(빈 하단 공백 없음).
export function CourseHome({navigation}: NativeStackScreenProps<ParentParams, 'CourseHome'>) {
  const {api, done, content, consented, syncError, sync} = useSession();
  const titleRef = useRef<unknown>(null); // P8 대화상자가 닫힌 뒤 포커스를 돌려줄 제목
  useLoadTodayContent();
  useBootLoading(content === undefined && !syncError); // 앱 시작 중이면 스플래시 대기 화면이 덮는다
  // 이번 주 도장: 연결 = 서버, 미연결 = 기기 로컬(useWeekStamps). 오늘 단계가 바뀌면 다시 받는다.
  const linked = content ? content.linked : undefined;
  const week = useWeekStamps(api, linked, done.length);
  // 단계 체크 모션(시안 P7_motion): 단계를 마치고 돌아온 순간 그 행만. 처음 열 때(이미 한 단계)는 움직이지 않는다
  const [justDone, setJustDone] = useState<StepName | null>(null);
  const prevDone = useRef<StepName[] | null>(null);
  useEffect(() => {
    if (content === undefined) {
      return;
    }
    const prev = prevDone.current;
    prevDone.current = done;
    if (prev && done.length > prev.length) {
      setJustDone(done.find(x => !prev.includes(x)) ?? null);
    }
  }, [done, content]);
  // 아직 아무것도 못 받았는데 실패: 오류만 보여 준다(오프라인/서버 오류 문구가 다름)
  if (content === undefined && syncError) {
    return (
      <Screen top={<Title />} bottom={<BigButton label={syncError.button} onPress={sync} />}>
        <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{syncError.title}</Text20>
        <Text20>{syncError.body}</Text20>
      </Screen>
    );
  }
  if (content === undefined) {
    return (
      <Screen top={<Title />}>
        <Text20 size={24}>{appCopy.loading}</Text20>
      </Screen>
    );
  }
  if (content === null || !content.photo || !content.question) {
    return (
      <Screen top={<Title />} bottom={<BigButton variant="secondary" label={appCopy.no_content.button} onPress={sync} />}>
        <Text20 size={24} weight="bold">{appCopy.no_content.title}</Text20>
        <Text20>{appCopy.no_content.body}</Text20>
      </Screen>
    );
  }
  const preview = !content.linked;
  const all = done.length === 3;
  const current = STEPS.find(s => !done.includes(s.step));
  // 다 마친 뒤 '오늘 다시 보기'(ease-and-joy B, 동결 P4_zoom_review·P5_P6_review): 세 단계 보기 전용, 기록 호출 0
  const review = (route: StepRoute) => navigation.navigate(route, {review: true});
  const dock = current ? (
    <>
      <Stitch width="100%" />
      <BigButton label={c.step[current.step]} onPress={() => navigation.navigate(current.route)} />
    </>
  ) : all ? (
    <>
      <Stitch width="100%" />
      <BigButton variant="secondary" label={c.review_link} onPress={() => review('PhotoStep')} />
    </>
  ) : undefined;
  const todayIdx = kstWeekdayIndex();
  const greeting = all
    ? preview
      ? c.done_unlinked
      : c.done_today
    : done.length === 1
      ? c.left_two
      : done.length === 2
        ? c.left_one
        : c.greeting;
  return (
    <Screen bottom={dock}>
      {/* P8: 연결된 어르신에게 온 읽지 않은 응원(미연결 열람은 묻지 않음) */}
      <CheerDialog api={api} enabled={!preview} returnFocusRef={titleRef} />
      <View style={styles.headGroup}>
        <View style={styles.titleRow}>
          <Header testID="date-line" label={kstDateLine()} nodeRef={titleRef} />
          {/* 설정은 연결 여부와 상관없이 늘 보인다(QA B3, 시안 P3) */}
          <TextLink label={copy.settings.open} icon="icon-settings" touch={64} onPress={() => navigation.navigate('Settings')} />
        </View>
        {preview ? (
          // 미연결 띠(시안 P3 v4 미연결 보드·talkback "날짜 다음"): 띠 전체가 하나의 버튼. 번호 화면을 위에 쌓아 '이전'이면 여기로(QA B2)
          <Pressable
            testID="course-strip"
            accessibilityRole="button"
            accessibilityLabel={c.disconnected_banner}
            onPress={() => navigation.push('Connect', {from: 'course'})}
            style={({pressed}) => [styles.strip, pressed ? styles.stripPressed : null]}>
            <Text20 weight="bold" style={styles.stripText}>{c.disconnected_banner}</Text20>
            <View style={styles.stripLink}>
              <Text20 weight="bold" oneLine style={styles.linkText}>{c.write_code}</Text20>
              <Icon name="icon-chevron-right" size={22} color={color.action} />
            </View>
          </Pressable>
        ) : !consented ? (
          // 동의 거부(시안 P3 v4 '동의 거부 · 한 줄'): 옅은 면, 테두리 없음. '다시 정하기'는 설정의 다시 보여 주기로
          <View testID="course-declined" style={styles.declined}>
            <Text20 weight="bold" style={styles.declinedText}>{c.declined_banner}</Text20>
            <TextLink label={c.declined_link} touch={size.touchMin} onPress={() => navigation.navigate('Settings')} />
          </View>
        ) : null}
      </View>
      <View style={styles.section}>
        <Stitch width="100%" />
      </View>
      {syncError ? (
        <View style={styles.notice}>
          <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{syncError.title}</Text20>
          <BigButton variant="secondary" label={syncError.button} onPress={sync} />
        </View>
      ) : null}
      <View style={styles.greetGroup}>
        <Text20 size={24} weight="bold" style={styles.title}>{greeting}</Text20>
        {/* 미연결 완료(11-7 #18): 가족에게 언제 보이는지 둘째 줄 */}
        {all && preview ? <Text20 weight="bold" style={styles.sub}>{c.done_unlinked_sub}</Text20> : null}
      </View>
      {week ? <StampRow days={stampsFromDates(week.weekStart, week.doneDates)} todayIdx={todayIdx} /> : null}
      <View testID="course-steps" style={styles.steps}>
        {STEPS.map(s => {
          const status = done.includes(s.step) ? 'done' : current?.step === s.step ? 'now' : 'wait';
          const statusLabel = status === 'done' ? c.status.done : status === 'now' ? c.status.now : c.status.later;
          // 다 마친 뒤 했어요 행 '›' → 그 단계 보기 전용
          const onPress = all ? () => review(s.route) : undefined;
          return (
            <StepRow
              key={s.step}
              title={c.step[s.step]}
              status={status}
              statusLabel={statusLabel}
              onPress={onPress}
              justDone={!all && justDone === s.step}
              tapeIn={!!justDone && status === 'now'}
            />
          );
        })}
      </View>
    </Screen>
  );
}

// 화면 제목(R2: Screen 이 첫 포커스로 등록). nodeRef 를 주면 그 요소도 알려 준다(P8 응원 대화상자가 닫힌 뒤 포커스 복귀, R12).
// 로딩·오류·빈 상태는 '오늘의 코스'(기존 P3 보드), 코스가 보이는 상태는 날짜 줄(시안 P3 v4).
function Title() {
  return <Header label={c.title} big />;
}

function Header({label, big, nodeRef, testID}: {label: string; big?: boolean; nodeRef?: React.RefObject<unknown>; testID?: string}) {
  const register = useScreenTitleRef(true);
  const ref = useCallback(
    (node: unknown) => {
      if (nodeRef) {
        nodeRef.current = node;
      }
      return register(node);
    },
    [nodeRef, register],
  );
  return (
    <View ref={ref} testID={testID} accessible accessibilityRole="header" accessibilityLabel={label} style={styles.header}>
      {/* 제목은 1.5 상한(리뷰 H3: 200%에서 날짜 줄이 여러 줄로 커지지 않게) */}
      <Text20 size={big ? 32 : 22} weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.title}>
        {label}
      </Text20>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle},
  sub: {color: color.ink},
  header: {flexShrink: 1},
  headGroup: {gap: 24}, // 날짜 줄 → 띠 = 구역 간격 24(시안, 리뷰 R5)
  titleRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8},
  // 구역 사이 24 = 본문 gap 16 + 위아래 8(스티치 위아래)
  section: {marginVertical: 8},
  greetGroup: {gap: 8},
  // 미연결 띠(시안): 흰 면, 3px 테두리, 반경 18, 패딩 12/16, wrap, 글 flexBasis 200 + 오른쪽 '번호 쓰기 ›'
  strip: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12, rowGap: 4,
    backgroundColor: color.card, borderWidth: 3, borderColor: color.action, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 16, minHeight: size.touchMin,
  },
  stripPressed: {backgroundColor: color.actionSoft},
  stripText: {flexGrow: 1, flexShrink: 1, flexBasis: 200, color: color.inkTitle},
  stripLink: {flexDirection: 'row', alignItems: 'center', gap: 2},
  linkText: {color: color.action, textDecorationLine: 'underline'},
  // 동의 거부 한 줄 띠(시안): 옅은 면, 테두리 없음, 패딩 12/16
  declined: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, backgroundColor: color.noticeSoft, borderRadius: radius.chip, paddingVertical: 12, paddingHorizontal: 16},
  declinedText: {flexGrow: 1, flexShrink: 1, flexBasis: 200, color: color.inkTitle},
  // 단계 행: 묶음 안 8, 위 구역과 24(= 16 + 8)
  steps: {gap: 8, marginTop: 8},
  notice: {backgroundColor: color.noticeSoft, borderRadius: radius.card, borderWidth: 4, borderColor: color.action, paddingVertical: 14, paddingHorizontal: 16, gap: 12},
});
