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

const c = copy.course;
type StepRoute = 'PhotoStep' | 'QuestionStep' | 'KeyboardStep';
const STEPS: {step: StepName; route: StepRoute}[] = [
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
  const {api, done, content, consented, syncError, sync} = useSession();
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
  const all = done.length === 3;
  const current = STEPS.find(s => !done.includes(s.step));
  const go = (route: StepRoute, from: string) => {
    mark(from);
    navigation.navigate(route);
  };
  // 했어요 행·다 마친 뒤 보조 버튼: 그 단계 보기 전용(기록 호출 0)
  const review = (route: StepRoute, from: string) => {
    mark(from);
    navigation.navigate(route, {review: true});
  };
  const dock: DockProps | undefined = current
    ? {primary: {label: c.step[current.step], testID: 'course-next', buttonRef: bind('dock'), onPress: () => go(current.route, 'dock')}}
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

  return (
    <DsScreen variant="step" header={header(kstDateLine())} dock={dock} onViewport={setViewH}>
      {/* P8: 연결된 어르신에게 온 읽지 않은 응원(미연결 열람은 묻지 않음). V1: 첫 인사가 보이는 첫 P3 에서는 묻지 않고 첫 단계 뒤에 */}
      <CheerDialog api={api} enabled={!preview && greetingDecided && !firstGreeting} returnFocusRef={titleRef} />
      {/* 본문 묶음(간격 12) + R-15 접힘 경계: 첫 화면 끝에 걸치는 행·줄은 통째로 아래로. 높이는 key 로 기억한다
          (도장 줄·인사 카드처럼 생겼다 사라지는 요소가 있어도 다른 요소 높이로 계산하지 않게, PR #133 리뷰 L1) — ui/FoldStack */}
      <FoldStack viewport={viewH} gap={BODY_GAP} testID="course-steps">
        {[
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
        all ? <Heading key="done-title" level={1} testID="course-done-title">{preview ? c.done_unlinked : c.done_today.replace('. ', '.\n')}</Heading> : null,
        // 미연결 완료(11-7 #18): 가족에게 언제 보이는지 둘째 줄
        all && preview ? <Text key="done-sub" role="body">{c.done_unlinked_sub}</Text> : null,
        // 찍은 날이 0이면 도장 줄을 숨긴다(빈 칸 7개는 정보가 없고 '아직'으로 읽힘, 감사 M1)
        showWeekStrip() && days ? <WeekStampStrip key="week" testID="course-week" days={days} /> : null,
        ...STEPS.map(s => {
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
              return (
                <ListRow
                  key={s.step}
                  testID={`step-done-${s.step}`}
                  tone="done"
                  pressRef={bind(`row-${s.step}`)}
                  accessibilityLabel={c.done_row_a11y.split('{단계}').join(name).split('{일}').join(day)}
                  accessibilityHint={c.review_row_hint}
                  onPress={() => review(s.route, `row-${s.step}`)}>
                  {/* D-2: '했어요'·도장·› 는 한 묶음(갈라지지 않음)으로 늘 오른쪽. 이름과 한 줄에 안 들어가면 묶음째 다음 줄 오른쪽 끝으로
                      — 왼쪽 줄 머리에 빈 원이 오면 라디오 버튼으로 읽힌다(11-19 V5) */}
                  <View testID="done-line" style={styles.inline}>
                    <Text role="bodyLg" style={styles.grow}>{name}</Text>
                    <View testID="done-status" style={styles.status}>
                      <Text testID="done-label" role="sub" tone="done">{c.status.done}</Text>
                      <StampIn key={justDone === s.step ? 'anim' : 'still'} animate={justDone === s.step} label={stampLabel} />
                      <Icon name="icon-chevron-right" size={ICON} color={ds.color.action} />
                    </View>
                  </View>
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
        ]}
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
});
