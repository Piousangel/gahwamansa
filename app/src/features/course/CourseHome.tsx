import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, useWindowDimensions, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Button, DateStamp, DsScreen, Heading, ListRow, SettingsLink, Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {prefs} from '../../lib/prefs';
import {Icon} from '../../ui/assets/icons';
import {useScreenTitleRef} from '../../ui/screenTitle';
import {useMotionMode} from '../../ui/motion';
import {appCopy, copy} from '../../copy/copy';
import {useLoadTodayContent} from './useTodayContent';
import {CheerDialog} from './CheerDialog';
import {kstDateLine, kstDayOfMonth, stampsFromDates} from './stamps';
import {useWeekStamps} from './useWeekStamps';
import {useAfterTransition} from './useAfterTransition';
import {useReturnFocus} from './useReturnFocus';
import {useCourseBgm} from './useCourseBgm';
import {Stitch} from '../../ui/assets/album';
import {FoldStack} from '../../ui/FoldStack';
import {useBootLoading} from '../../app/splash';
import {WeekStampStrip, showWeekStrip} from './WeekStampStrip';
import type {StepName} from '../types';
import {allStepsDone, FIVE_STEP_ORDER, nowRowRange, skippedOf, type StepEntry, type StepRoute} from './fiveSteps';
import {stepA11y} from './StepHeader';
import {useStopHere} from './useFinishStep';

const c = copy.course;
// 3단계(기본). 기능 스위치 fiveSteps 가 켜지면 fiveSteps.FIVE_STEP_ORDER(5행)
const STEPS: StepEntry[] = [
  {step: 'photo', route: 'PhotoStep'},
  {step: 'question', route: 'QuestionStep'},
  {step: 'hangul', route: 'KeyboardStep'},
];

// P3 코스 홈 v4(시안 P3_P4_P5_ds4b, list 틀).
// - 위 영역: 날짜 줄(화면 제목, 첫 포커스·P8 닫힌 뒤 복귀) + 오른쪽 '음악 끄기'(소리 날 때만, 켜기는 설정) · '설정'.
// - 본문(간격 12): [첫날] 해님 인사 카드 1개 / [다 마침] 제목 '오늘 코스는 여기까지예요…' → 이번 주 도장 줄(찍은 날이 있을 때)
//   → 단계 행 3개 → 스티치(화면당 1곳) → '지난 날 보기'(목록 아래).
// - 단계 행: 지금 = 눌리는 행('지금 할 차례' accent 태그 + 이름 + ›), 했어요 = 눌리는 행('했어요' + 날짜 도장 + ›, 누르면 그 단계 다시 보기 — 리드 결정 시안 1:1),
//   다음 = 누르지 않는 행. 읽기 이름은 보이는 글과 같게(R-14), '다시 보기'는 힌트로.
// - Dock: 지금 단계 이름(주). 다 마치면 보조 '오늘 코스 다시 보기' → '오늘 한 장'(TodayReviewScreen, D-3).
export function CourseHome({navigation}: NativeStackScreenProps<ParentParams, 'CourseHome'>) {
  const {api, done, content, consented, syncError, sync, five} = useSession();
  // 5단계(기능 스위치, 기본 꺼짐): 5행 · A′(다음 행은 이름만) · ③ 뒤 '오늘은 여기까지' · 다 마치면 제목 옆 도장 1개 · 열릴 때 지금 행으로 스크롤.
  // 꺼져 있으면 아래 five 분기는 모두 지나가고 3단계 화면 그대로다
  const steps = five ? FIVE_STEP_ORDER : STEPS;
  const {stop, error: stopError, busy: stopping} = useStopHere();
  const scrollRef = useRef<{showRange(top: number, bottom: number): void}>(null); // DsScreen scrollRef(ui/Screen ScreenScroll 과 같은 꼴)
  const [rowsAt, setRowsAt] = useState<{top: number; heights: Readonly<Record<string, number>>} | null>(null);
  const onRows = useCallback((top: number, heights: Readonly<Record<string, number>>) => setRowsAt({top, heights}), []);
  const order = useRef<string[]>([]); // 본문 묶음 key 순서(지금 행 위치 계산용)
  const titleRef = useRef<unknown>(null); // P8 대화상자가 닫힌 뒤 포커스를 돌려줄 제목
  useLoadTodayContent();
  useBootLoading(content === undefined && !syncError); // 앱 시작 중이면 스플래시 대기 화면이 덮는다
  // 이번 주 도장: 연결 = 서버, 미연결 = 기기 로컬(useWeekStamps). 오늘 단계가 바뀌면 다시 받는다.
  const linked = content ? content.linked : undefined;
  const week = useWeekStamps(api, linked, done.length);
  // 단계 체크 모션: 단계를 마치고 위 화면이 닫히는 전환이 끝난 뒤 그 행의 ✓ 만(처음 열 때는 움직이지 않는다)
  const [justDone, setJustDone] = useState<StepName | null>(null);
  const prevDone = useRef<StepName[] | null>(null);
  const afterTransition = useAfterTransition(navigation);
  const {show: firstGreeting, decided: greetingDecided} = useFirstGreeting(linked === true, navigation);
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const music = useCourseBgm('home'); // AP-04: 음원(CT-04)이 없으면 available=false 라 버튼도 없다
  // D-10: 뒤로 돌아오면 떠날 때 누른 요소로(없어졌으면 날짜 줄 제목)
  const {bind, mark} = useReturnFocus(navigation, afterTransition, () => titleRef.current);
  const [viewH, setViewH] = useState(0); // R-15 접힘 기준 창(FoldBody)
  // 5단계: 홈이 열리거나 지금 행이 바뀌면 그 행이 보이게(시안 리스크 1 — 360×640 100%에서도 ③ 뒤 지금 행이 첫 화면 끝에 걸린다)
  const nowStep = five && content ? steps.find(s => !done.includes(s.step))?.step ?? null : null;
  // 행 위치는 자연 위치(접힘 여백 없음). 내려야 하는 날은 아래 FoldStack 이 여백을 끄므로 실제 위치와 같다(#254 캡처 문제 1)
  const nowAt = (): ReturnType<typeof nowRowRange> =>
    nowStep && rowsAt ? nowRowRange(order.current, rowsAt.top, rowsAt.heights, BODY_GAP, nowStep, viewH) : null;
  // 내릴지는 지금 행마다 한 번, 열린 뒤 첫 측정 묶음(모든 요소를 처음 다 잰 때)으로 정하고 고정한다(#259 QA-2 M1·재확인 M, 리드 결정).
  // - 내렸으면: 뒤에 높이가 바뀌어도 접힘 여백을 다시 켜지 않는다(켜면 내린 화면 안에 빈칸).
  // - 안 내렸으면: 뒤에 위쪽 안내(여기까지 실패·동기화 오류)가 끼어들어 행이 밀려도 내리지 않는다 — 막 뜬 실패 안내가 화면에 보여야 한다.
  //   그때는 접힘 여백 규칙(R-15) 그대로.
  // 단계가 바뀌면(④ → ⑤) 새 지금 행으로 다시 정한다
  const [decided, setDecided] = useState<{step: string; scrolled: boolean} | null>(null);
  useEffect(() => {
    if (!nowStep || !rowsAt || viewH <= 0 || decided?.step === nowStep) {
      return;
    }
    const at = nowRowRange(order.current, rowsAt.top, rowsAt.heights, BODY_GAP, nowStep, viewH);
    if (!at) {
      return; // 아직 다 재지 않음
    }
    if (at.scroll) {
      scrollRef.current?.showRange(at.top, at.bottom);
    }
    setDecided({step: nowStep, scrolled: at.scroll});
  }, [nowStep, rowsAt, viewH, decided]);
  useEffect(() => {
    if (content === undefined) {
      return;
    }
    const prev = prevDone.current;
    prevDone.current = done;
    if (prev && done.length > prev.length) {
      const step = done.find(x => !prev.includes(x)) ?? null;
      afterTransition(() => setJustDone(step));
    }
  }, [done, content, afterTransition]);

  const header = (label: string) => (
    <View style={styles.headRow}>
      <Header testID="date-line" label={label} nodeRef={titleRef} />
      <View style={styles.headLinks}>
        {/* 시안: 음악은 소리가 날 때만 '음악 끄기'(켜기는 설정) */}
        {music.available && music.enabled ? <Button kind="text" size="inline" label={copy.bgm.toggle_off} onPress={() => music.setEnabled(false)} /> : null}
        {/* 설정: 톱니 + 글자, 자녀 상단 바와 같은 SettingsLink(오너 S25 P-3) */}
        <SettingsLink
          label={copy.settings.open}
          testID="course-settings"
          buttonRef={bind('settings')}
          onPress={() => {
            mark('settings');
            navigation.navigate('Settings');
          }}
        />
      </View>
    </View>
  );

  // 아직 아무것도 못 받았는데 실패: 오류만 보여 준다(오프라인/서버 오류 문구가 다름)
  if (content === undefined && syncError) {
    return (
      <DsScreen variant="step" header={<Header label={c.title} />} dock={{primary: {label: syncError.button, onPress: sync}}}>
        <View accessibilityLiveRegion="polite">
          <Text role="heading">{syncError.title}</Text>
        </View>
        <Text role="body">{syncError.body}</Text>
      </DsScreen>
    );
  }
  if (content === undefined) {
    return (
      <DsScreen variant="step" header={<Header label={c.title} />}>
        <Text role="bodyLg">{appCopy.loading}</Text>
      </DsScreen>
    );
  }
  if (content === null || !content.photo || !content.question) {
    return (
      <DsScreen variant="step" header={<Header label={c.title} />} dock={{primary: {kind: 'primary', label: appCopy.no_content.button, onPress: sync}}}>
        <Text role="heading">{appCopy.no_content.title}</Text>
        <Text role="body">{appCopy.no_content.body}</Text>
      </DsScreen>
    );
  }
  const preview = !content.linked;
  const all = allStepsDone(done, five); // 꺼짐도 옛 3단계 이름으로 센다(기록에 5단계 이름이 섞여도, QA-1 M1)
  const current = steps.find(s => !done.includes(s.step));
  const go = (route: StepRoute, from: string) => {
    mark(from);
    navigation.navigate(route);
  };
  // 했어요 행·다 마친 뒤 보조 버튼: 그 단계 보기 전용(기록 호출 0)
  const review = (route: StepRoute, from: string) => {
    mark(from);
    navigation.navigate(route, {review: true});
  };
  // 5단계: ③을 마친 뒤 남은 단계가 있으면 '오늘은 여기까지 할게요'(확인 대화상자 없음). 100%는 Dock 주 버튼 아래 글자 버튼,
  // 200%는 단계 행 바로 아래 본문(시안 s4 B1 — Dock 에 두면 두 줄로 꺾여 40%를 넘는다)
  const rest = steps.slice(steps.findIndex(s => s.step === 'question') + 1).map(s => s.step).filter(s => !done.includes(s));
  const canStop = five && !all && done.includes('question') && rest.length > 0;
  const onStop = async () => {
    mark('stop');
    if ((await stop(rest)) === 'done') {
      navigation.navigate('CourseDone'); // P7: 몇 단계 했는지 말하지 않는다
    }
  };
  // 다 마친 뒤 넘긴 ④·⑤는 다시 할 수 있게 연다(DECISIONS 5단계 화면 — 넘김도 '했어요'라 도장은 그대로). 넘긴 목록은 서버 skipped_steps(앱을 다시 켜도 남는다)
  // 앱이 스스로 넘긴 단계(⑤ 서버 스위치 꺼짐 — 할 수도 없다)는 열지 않는다(리드 결정 #254 QA-1 L3: 행은 '했어요'로 두고 누르면 보기 전용). ②는 원래 다시 하기 대상이 아니다
  const reopen = (step: StepName) =>
    five && all && (step === 'hangul' || (step === 'pass_on' && !!content.pass_on?.enabled)) && skippedOf(content).includes(step);
  const dock: DockProps | undefined = current
    ? {
        primary: {label: c.step[current.step], testID: 'course-next', buttonRef: bind('dock'), onPress: () => go(current.route, 'dock')},
        ...(canStop && !large ? {secondary: {kind: 'text' as const, label: c.stop_here, disabled: stopping, testID: 'course-stop', buttonRef: bind('stop'), onPress: onStop}} : {}),
      }
    : all
      ? {primary: {kind: 'secondary', label: c.review_link, icon: 'icon-photo', testID: 'course-review', buttonRef: bind('dock'), onPress: () => {
          mark('dock');
          navigation.navigate('TodayReview'); // D-3 안 A '오늘 한 장'(한 화면, 기록 호출 0)
        }}}
      : undefined;
  const days = week && week.doneDates.length > 0 ? stampsFromDates(week.weekStart, week.doneDates) : null;
  // D-2 날짜 도장: 했어요 행은 오늘(KST) 마친 단계뿐이라 날짜 = 오늘
  const day = String(kstDayOfMonth());
  const stampLabel = c.done_stamp.split('{일}').join(day);

  const doneTitle = preview ? c.done_unlinked : c.done_today.replace('. ', '.\n');
  // 본문 묶음(간격 12) + R-15 접힘 경계: 첫 화면 끝에 걸치는 행·줄은 통째로 아래로. 높이는 key 로 기억한다
  // (도장 줄·인사 카드처럼 생겼다 사라지는 요소가 있어도 다른 요소 높이로 계산하지 않게, PR #133 리뷰 L1) — ui/FoldStack
  const items: React.ReactNode[] = [
        preview ? (
          // 미연결 띠: 띠 전체가 하나의 버튼(번호 화면을 위에 쌓아 '이전'이면 여기로)
          <ListRow
            key="strip"
            testID="course-strip"
            tone="done"
            pressRef={bind('strip')}
            accessibilityLabel={`${c.disconnected_banner}, ${c.write_code}`}
            onPress={() => {
              mark('strip');
              navigation.push('Connect', {from: 'course'});
            }}>
            <Text role="bodyLg">{c.disconnected_banner}</Text>
            <View style={styles.inline}>
              <Text role="label">{c.write_code}</Text>
              <Icon name="icon-chevron-right" size={ICON} color={ds.color.action} />
            </View>
          </ListRow>
        ) : !consented ? (
          // 동의 거부 한 줄 띠(옅은 면, 테두리 없음). '다시 정하기'는 설정의 다시 보여 주기를 펼친 채로
          <View key="declined" testID="course-declined" style={styles.declined}>
            <Text role="bodyLg">{c.declined_banner}</Text>
            <Button
              kind="text"
              size="inline"
              label={c.declined_link}
              buttonRef={bind('declined')}
              onPress={() => {
                mark('declined');
                navigation.navigate('Settings', {expand: 'resume'});
              }}
            />
          </View>
        ) : null,
        // 5단계 '여기까지' 기록 실패: 무슨 일인지 + 다시 하기(이미 인정된 단계는 그대로 '했어요')
        stopError ? (
          <View key="stop-error" testID="course-stop-error" style={styles.notice} accessibilityLiveRegion="polite">
            <Text role="heading">{stopError.title}</Text>
            <Button kind="secondary" size="inline" label={stopError.button} onPress={onStop} />
          </View>
        ) : null,
        syncError ? (
          <View key="sync" style={styles.notice} accessibilityLiveRegion="polite">
            <Text role="heading">{syncError.title}</Text>
            <Button kind="secondary" size="inline" label={syncError.button} onPress={sync} />
          </View>
        ) : null,
        /* 첫날 해님 인사 카드 1개(V1, 알림 안내는 첫 도장 뒤 N1). 200%는 인사 둘째 줄 '하나씩 차례로 해요'를 카드 밖 제목으로(시안 200% 보드) */
        firstGreeting ? (
          <View key="greet" testID="first-greeting" style={styles.greet} accessible accessibilityLabel={large ? copy.connect.greeting : `${copy.connect.greeting}, ${c.greeting}`}>
            <Icon name="icon-sun" size={GREET_ICON} color={ds.deprecatedColor.sunRay} /* R-23 장식 — 화면 레인이 걷어 낼 때까지(병합 #179) */ />
            <View style={styles.greetText}>
              <Text role="bodyLg">{copy.connect.greeting}</Text>
              {large ? null : <Text role="sub">{c.greeting}</Text>}
            </View>
          </View>
        ) : null,
        firstGreeting && large ? <Heading key="greet-title" level={1}>{c.greeting}</Heading> : null,
        all && !five ? <Heading key="done-title" level={1} testID="course-done-title">{doneTitle}</Heading> : null,
        // 5단계 다 마침: 제목 옆 날짜 도장 1개(시안 s1 C-나, 행마다 도장 다섯 개 = 쿠폰판으로 읽힘). 읽기는 제목 + 도장 날짜 한 번
        all && five ? (
          <View key="done-title" testID="course-done-head" style={large ? styles.doneHeadLarge : styles.doneHead} accessible accessibilityRole="header" accessibilityLabel={`${doneTitle.replace('\n', ' ')}, ${stampLabel}`}>
            <View testID="course-done-head-text" style={large ? undefined : styles.doneHeadText}>
              <Heading level={1} testID="course-done-title">{doneTitle}</Heading>
            </View>
            <View testID="course-done-head-stamp" style={large ? styles.doneStampLarge : styles.doneStamp}>
              <DateStamp testID="done-title-stamp" label={stampLabel} />
            </View>
          </View>
        ) : null,
        // 미연결 완료(11-7 #18): 가족에게 언제 보이는지 둘째 줄
        all && preview ? <Text key="done-sub" role="body">{c.done_unlinked_sub}</Text> : null,
        // 찍은 날이 0이면 도장 줄을 숨긴다(빈 칸 7개는 정보가 없고 '아직'으로 읽힘, 감사 M1)
        showWeekStrip() && days ? <WeekStampStrip key="week" testID="course-week" days={days} /> : null,
        ...steps.map((s, i) => {
            const status = done.includes(s.step) ? 'done' : current?.step === s.step ? 'now' : 'wait';
            const name = c.step[s.step];
            if (status === 'now') {
              return (
                <ListRow
                  key={s.step}
                  testID="step-now-row"
                  tone="now"
                  pressRef={bind(`row-${s.step}`)}
                  accessibilityLabel={`${name}, ${c.status.now}`}
                  onPress={() => go(s.route, `row-${s.step}`)}>
                  <View style={styles.tag}>
                    <Text role="sub" tone="accent">{c.status.now}</Text>
                  </View>
                  <View style={styles.inline}>
                    <Text role="bodyLg" style={styles.grow}>{name}</Text>
                    <Icon name="icon-chevron-right" size={ICON} color={ds.color.action} />
                  </View>
                </ListRow>
              );
            }
            if (status === 'done') {
              // 5단계 다 마친 화면은 행마다 도장 없이 제목 옆 1개. 넘긴 ④·⑤(다시 할 수 있음)는 누르면 그 단계를 연다(보기 전용 아님)
              const rowStamp = !(five && all);
              const again = reopen(s.step);
              return (
                <ListRow
                  key={s.step}
                  testID={`step-done-${s.step}`}
                  tone="done"
                  pressRef={bind(`row-${s.step}`)}
                  accessibilityLabel={rowStamp ? c.done_row_a11y.split('{단계}').join(name).split('{일}').join(day) : `${name}, ${c.status.done}`}
                  accessibilityHint={again ? undefined : c.review_row_hint}
                  onPress={() => (again ? go(s.route, `row-${s.step}`) : review(s.route, `row-${s.step}`))}>
                  {/* D-2: '했어요'·도장·› 는 한 묶음(갈라지지 않음)으로 늘 오른쪽. 이름과 한 줄에 안 들어가면 묶음째 다음 줄 오른쪽 끝으로
                      — 왼쪽 줄 머리에 빈 원이 오면 라디오 버튼으로 읽힌다(11-19 V5) */}
                  <View testID="done-line" style={styles.inline}>
                    <Text role="bodyLg" style={styles.grow}>{name}</Text>
                    <View testID="done-status" style={styles.status}>
                      <Text testID="done-label" role="sub" tone="done">{c.status.done}</Text>
                      {rowStamp ? <StampIn key={justDone === s.step ? 'anim' : 'still'} animate={justDone === s.step} label={stampLabel} /> : null}
                      <Icon name="icon-chevron-right" size={ICON} color={ds.color.action} />
                    </View>
                  </View>
                </ListRow>
              );
            }
            if (five) {
              // A′(라이터 #9 채택): 다음 행은 이름만 — '다음 차례'를 보이는 글·읽기 모두에서 뺀다(남은 단계를 세는 효과 제거). 읽기 '{단계}, 5단계 중 {n}단계'
              return (
                <ListRow key={s.step} testID={`step-wait-${s.step}`} tone="wait" accessibilityLabel={stepA11y(name, i + 1, false, true)}>
                  <Text role="bodyLg">{name}</Text>
                </ListRow>
              );
            }
            // 다음 차례: 첫날 인사가 보이는 동안은 이름만(시안 0/3 보드), 그 밖에는 '다음 차례' 한 줄
            return (
              <ListRow key={s.step} testID={`step-wait-${s.step}`} tone="wait" accessibilityLabel={firstGreeting ? name : `${name}, ${c.status.later}`}>
                <Text role="bodyLg">{name}</Text>
                {firstGreeting ? null : <Text role="sub">{c.status.later}</Text>}
              </ListRow>
            );
          }),
        // 5단계 200%: '오늘은 여기까지 할게요'는 단계 행 바로 아래 본문(시안 s4 B1)
        canStop && large ? (
          <View key="stop" style={styles.linkRow}>
            <Button kind="text" size="inline" label={c.stop_here} disabled={stopping} testID="course-stop" buttonRef={bind('stop')} onPress={onStop} />
          </View>
        ) : null,
        <Stitch key="stitch" width="100%" />,
        // P15 진입(시안: 단계 목록 아래). 미연결 기기는 서버 기록이 없으므로 숨김
        preview ? null : (
          <View key="history" style={styles.linkRow}>
            <Button
              kind="text"
              size="inline"
              label={c.history_link}
              buttonRef={bind('history')}
              onPress={() => {
                mark('history');
                navigation.navigate('History');
              }}
            />
          </View>
        ),
  ];
  order.current = items.filter(Boolean).map(x => String((x as React.ReactElement).key));
  // 5단계에서 지금 행으로 내리는 날(또는 아직 재는 중)은 접힘 여백을 끈다: 사용자가 처음 보는 화면은 내린 화면이고, 그 아래 끝은
  // 지금 행 끝 + 간격 12(showRange 여유) = 다음 행 위 끝이라 줄 경계가 맞는다. 여백을 두면 내린 화면 위에 빈칸이 생기고 위치도 어긋난다
  // 정한 뒤(decided)는 그 결정대로 고정, 정하기 전(재는 중)은 내릴 것 같으면 끈다(QA-2 M1·재확인 M)
  const now = nowAt();
  const offBeforeDecide = !now || now.scroll;
  const foldViewport = nowStep && (decided?.step === nowStep ? decided.scrolled : offBeforeDecide) ? 0 : viewH;

  return (
    <DsScreen variant="step" header={header(kstDateLine())} dock={dock} onViewport={setViewH} scrollRef={five ? scrollRef : undefined}>
      {/* P8: 연결된 어르신에게 온 읽지 않은 응원(미연결 열람은 묻지 않음). V1: 첫 인사가 보이는 첫 P3 에서는 묻지 않고 첫 단계 뒤에 */}
      <CheerDialog api={api} enabled={!preview && greetingDecided && !firstGreeting} returnFocusRef={titleRef} />
      <FoldStack viewport={foldViewport} gap={BODY_GAP} testID="course-steps" onMeasure={five ? onRows : undefined}>
        {items}
      </FoldStack>
    </DsScreen>
  );
}

// 방금 마친 행의 날짜 도장: 전환이 끝난 뒤 280ms 페이드(시안 P7_motion 단계 체크, 동작 줄이기 200ms). 판정 전(null)에는 시작하지 않는다.
// 진동·소리 없음(단계마다 울리면 남발)
function StampIn({animate, label}: {animate: boolean; label: string}) {
  const mode = useMotionMode();
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate || mode === null) {
      return undefined;
    }
    const a = Animated.timing(v, {toValue: 1, duration: mode === 'full' ? 280 : 200, useNativeDriver: true});
    a.start();
    return () => a.stop();
  }, [animate, mode, v]);
  const stamp = <DateStamp testID="done-stamp" label={label} />;
  return animate ? (
    <Animated.View testID="step-check-anim" style={{opacity: v}}>
      {stamp}
    </Animated.View>
  ) : (
    stamp
  );
}

// 해님 첫 인사 1회(DECISIONS 11-17 "첫 인사는 어르신 연결 직후 앨범 첫 화면", PM 백로그 D4).
// 연결된 상태로 처음 열린 코스 홈에서만 보이고, 보인 순간 기기에 기록한다. 이 방문 동안은 그대로 두고(다시 그려도 유지),
// 첫 단계를 시작하거나 다른 화면으로 떠나면(blur) 거둔다 → 돌아와도 다시 나오지 않는다(디자인 판정 ①).
// V1(DECISIONS 11-19): 첫 P3 덮개는 이 인사 1개만 — decided(인사를 띄울지 판정 끝)가 되기 전과 인사가 보이는 동안은
// P8 응원 대화상자를 묻지 않는다. 첫 단계를 마치고 돌아오면(blur 로 인사가 거둬진 뒤) 그때 묻는다.
function useFirstGreeting(
  linked: boolean,
  navigation: {addListener(name: 'blur', cb: () => void): () => void},
): {show: boolean; decided: boolean} {
  const [show, setShow] = useState(false);
  const [decided, setDecided] = useState(false);
  useEffect(() => navigation.addListener('blur', () => setShow(false)), [navigation]);
  useEffect(() => {
    if (!linked) {
      return undefined;
    }
    let alive = true;
    prefs()
      .firstGreetingSeen()
      .then(seen => {
        if (!alive) {
          return;
        }
        if (!seen) {
          setShow(true);
          prefs().markFirstGreetingSeen();
        }
        setDecided(true);
      });
    return () => {
      alive = false;
    };
  }, [linked]);
  return {show, decided};
}

// 화면 제목(R2: Screen 이 첫 포커스로 등록). nodeRef 를 주면 그 요소도 알려 준다(P8 응원 대화상자가 닫힌 뒤 포커스 복귀, R12).
// 로딩·오류·빈 상태는 '오늘의 코스', 코스가 보이는 상태는 날짜 줄(시안 heading 26).
function Header({label, nodeRef, testID}: {label: string; nodeRef?: React.RefObject<unknown>; testID?: string}) {
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
      <Text role="heading">{label}</Text>
    </View>
  );
}

const ICON = 24;
const BODY_GAP = 12; // 시안 data-body gap 12
const GREET_ICON = 36; // 시안 해님 36
const styles = StyleSheet.create({
  headRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: ds.space.group},
  headLinks: {flexDirection: 'row', alignItems: 'center', columnGap: ds.space.group},
  header: {flexShrink: 1},
  body: {gap: BODY_GAP},
  inline: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6},
  // 이름은 줄이지 않는다(좁으면 상태 묶음이 다음 줄로 — 320×640 200% 실측: '사진/보기'로 꺾였다)
  grow: {flexGrow: 1},
  // D-2 상태 묶음: 갈라지지 않고(nowrap·줄지 않음) 왼쪽 여백 auto 로 늘 오른쪽 끝 — 다음 줄로 내려가도 줄 머리에 원이 오지 않는다
  status: {flexDirection: 'row', flexWrap: 'nowrap', flexShrink: 0, marginLeft: 'auto', alignItems: 'center', columnGap: 6},
  // '지금 할 차례' 태그: 흰 면 + accent 테두리 1.5(화면당 accent 1곳, R-07)
  tag: {alignSelf: 'flex-start', backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.accent, borderRadius: ds.radius.chip, paddingHorizontal: 12, paddingVertical: 2},
  // 해님 인사 카드: 흰 면 + line 1.5, 반경 22, 패딩 8/14
  greet: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, paddingVertical: 8, paddingHorizontal: 14},
  greetText: {flexShrink: 1},
  declined: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, backgroundColor: ds.color.noticeSoft, borderRadius: ds.radius.chip, paddingVertical: 12, paddingHorizontal: 16},
  notice: {backgroundColor: ds.color.noticeSoft, borderRadius: ds.radius.card, paddingVertical: 14, paddingHorizontal: 16, gap: 12},
  linkRow: {alignSelf: 'flex-start'},
  // 5단계 다 마침 머리줄: 제목 + 도장 1개(시안 s1 C-나). 줄바꿈(wrap) 묶음은 쓰지 않는다 — 여러 줄로 꺾이는 글은 한 줄 전체 폭을
  // 차지해 도장이 늘 아래 줄 왼쪽(줄 머리)으로 갔다(#254 캡처 문제 5). 150% 미만: 제목이 남은 폭을 갖고 도장은 옆(줄지 않음)
  doneHead: {flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', columnGap: 12},
  doneHeadText: {flex: 1, minWidth: 0},
  doneStamp: {flexShrink: 0}, // 도장은 줄지 않는다(제목이 남은 폭을 갖는다)
  // 150% 이상: 옆에 두면 제목 낱말이 가운데서 꺾인다(320 200% 제목 폭 178 < '여기까지예요.' 220) → 제목 끝 아래 오른쪽(낙관 자리).
  // 줄 머리(왼쪽)에는 두지 않는다 — 왼쪽 원은 라디오 버튼으로 읽힌다(11-19 V5, 단계 행 D-2 상태 묶음과 같은 규칙)
  doneHeadLarge: {flexDirection: 'column', rowGap: 6},
  doneStampLarge: {alignSelf: 'flex-end'},
});
