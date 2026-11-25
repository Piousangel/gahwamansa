import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, useWindowDimensions, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useBackAction} from '../../app/BackBar';
import {useSession} from '../../app/session';
import {DsScreen, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {useFoldGap} from '../../ui/ds/useFoldGap';
import {copy} from '../../copy/copy';
import {kstWeekdayIndex, kstYmd, stampsFromDates} from './stamps';
import {useWeekStamps} from './useWeekStamps';
import {useMotionMode} from '../../ui/motion';
import {newStampFeedback} from './stampFeedback';
import {prefs} from '../../lib/prefs';
import {Dialog} from '../../ui/Dialog';
import {focusLater} from '../../ui/screenTitle';
import {useCourseBgm} from './useCourseBgm';
import {AlbumMount, type MountMotion} from './AlbumMount';
import {WeekStampStrip, showWeekStrip} from './WeekStampStrip';
import {BIG_TEXT_SCALE, isBigText} from '../../ui/bigText';

const d = copy.done;
const WEEK_WAIT_MS = 1500;

// 타임라인(시안 P7_album_ds4 주석, 새 모션 없음 = opacity·scale 만):
// 0~300ms 사진 마운트·테이프 페이드 → 300ms 도장 scale 1.3→1(180ms) → 480ms 닿음(촉각·소리 1회) + 눌림 scaleY .94 70ms 뒤 복원
// → 520ms 번짐 원 opacity .10→0·scale .9→1.15(420ms) → 700ms 본문 둘째 줄 300ms 페이드
export const P7_T = {mountFade: 300, stampAt: 300, land: 180, squash: 70, inkAt: 520, ink: 420, textAt: 700, text: 300} as const;
const INK_FROM = 0.1; // 번짐 원 투명도(축하 효과로 보이지 않게, PR #80 리뷰 L1)
// 이징(시안 CSS cubic-bezier 그대로)
const EASE = {land: Easing.bezier(0.3, 0, 0.8, 0.15), squash: Easing.bezier(0.2, 0.8, 0.2, 1)};
const BODY_GAP = 16;
/**
 * 본문을 마운트보다 먼저 두는 글자 배율(대기열 33, 리드 결정 #263 QA-2 M1 = 1.6). Android 1.8·2.0 과 함께
 * iOS Dynamic Type AX1(약 1.64)·제조사 중간 단계·'화면 크기'를 키운 150%처럼 1.5를 조금 넘는 배율도 본문 먼저로 둔다.
 * 1.5 는 320×640 에서도 본문까지 첫 화면에 들어(에뮬레이터 실측 43 남음) 시안 순서(마운트 먼저)를 그대로 둔다.
 * 접힘 실측으로 고르지 않는 이유: 본문 글은 이번 주 도장 응답 뒤에야 정해져(최대 1.5초) 그때 제목이 위로 튄다.
 */
export const P7_BODY_FIRST_SCALE = BIG_TEXT_SCALE; // 공용 문턱(ui/bigText)
export const p7BodyFirst = isBigText;
const tween = (val: Animated.Value, toValue: number, duration: number, delay = 0, easing?: (x: number) => number) =>
  Animated.timing(val, {toValue, duration, delay, easing, useNativeDriver: true}); // 본문 간격(시안 data-body gap 16)

// P7 코스 완료(시안 P7_album_ds4 + 디자인 #95). 3/3을 마친 직후 한 번, '알겠어요'(·뒤로가기)로 코스 홈으로.
// - 앨범 물건 하나: 사진 마운트 + 테이프 + 큰 인장 '家'. 캡션 두 줄은 AI 고지(법무). 제목·'알겠어요'는 첫 프레임부터 보인다(감사 M9).
// - 동작 줄이기·화면 읽기: 모두 즉시 끝 상태(번짐 없음). 소리·촉각은 유지(움직임이 아님). 판정 전(첫 프레임)에는 아무 연출도 시작하지 않는다.
// - 건너뛰기 안내·화면 누르기 건너뛰기 없음(UX 깊이 V20 — 연출이 1초 안에 끝난다).
// - 미연결도 같은 연출(도장은 기기에 찍힘, 11-7 #19). 칭찬·연속·하트·숫자 없음.
export function CourseDone({navigation}: NativeStackScreenProps<ParentParams, 'CourseDone'>) {
  const {api, content, five} = useSession();
  const linked = !!content?.linked;
  const fetched = useWeekStamps(api, content ? content.linked : undefined, 'done');
  // 이번 주 도장 응답이 1.5초 안에 오지 않으면 도장 줄 없이 진행(둘째 줄이 투명으로 고착되지 않게, 리뷰 후속)
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (fetched !== undefined) {
      return undefined;
    }
    const t = setTimeout(() => setGaveUp(true), WEEK_WAIT_MS);
    return () => clearTimeout(t);
  }, [fetched]);
  // 포기한 뒤 늦게 온 결과는 이 화면에서 무시(도장 줄이 뒤늦게 생겨 본문이 움직이거나 문구가 바뀌지 않게)
  const week = gaveUp ? null : fetched;
  const mode = useMotionMode();
  const toHome = () => navigation.popTo('CourseHome');
  // AP-04 완료 1회 권유(V1: 첫날 제외, 두 번째 완료한 날부터)(시안 PX_music): 연출이 끝난 뒤 '음악을 틀어 드릴까요?' → 들어 볼게요면 켜고 미리 듣기 상자.
  // 음원(CT-04)이 없거나 화면 읽기 켜짐이면 묻지 않는다. 한 번 보이면 다시 묻지 않는다(prefs bgmOffered)
  const music = useCourseBgm('done');
  const [offer, setOffer] = useState<'none' | 'ask' | 'preview'>('none');
  // 처음 코스를 마친 날(없으면 오늘로 기록). 음원이 없어도 기록해야 나중에 음원이 풀렸을 때 첫날 판정이 맞다
  const [firstDoneDay] = useState(() => prefs().noteFirstDoneDay(kstYmd()));
  useBackAction(toHome);
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const bodyFirst = p7BodyFirst(fontScale);

  const titleNode = useRef<unknown>(null);
  useEffect(() => focusLater(() => titleNode.current), []);
  const feedback = useRef(newStampFeedback()).current;
  const [phase, setPhase] = useState<'wait' | 'run' | 'done'>('wait');
  const v = useRef({
    mount: new Animated.Value(0),
    sealOpacity: new Animated.Value(0),
    sealScale: new Animated.Value(1.3),
    squash: new Animated.Value(1),
    inkOpacity: new Animated.Value(0),
    inkScale: new Animated.Value(0.9),
    text: new Animated.Value(0),
  }).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const running = useRef<Animated.CompositeAnimation[]>([]);
  const alive = useRef(true);

  // 연출은 동작 줄이기 판정(mode)만 정해지면 시작한다. 이번 주 도장 응답(week)이 필요한 것은 둘째 줄뿐이라
  // 둘째 줄 페이드만 따로 기다린다(PR #108 리뷰 L2 — 응답을 기다리는 동안 사진·도장까지 투명하지 않게)
  const startedAt = useRef(0);
  // 본문 먼저 배치(리드 결정 #263 QA-2 M2): 마운트가 첫 화면 밖이라 도장은 처음부터 찍힌 상태로 그리고,
  // 촉각·소리는 어르신이 보는 「…도장을 찍었어요」가 나타나는 순간으로 옮긴다. 연출 시작 때 한 번 정한다(도중에 배율이 바뀌어도 두 번 울리지 않게)
  const stampWithText = useRef(false);
  useEffect(() => {
    if (mode === null || phase !== 'wait') {
      return;
    }
    setPhase('run');
    startedAt.current = Date.now();
    if (bodyFirst) {
      stampWithText.current = true;
      v.mount.setValue(1);
      v.sealOpacity.setValue(1);
      v.sealScale.setValue(1);
      return; // 끝(phase done)은 본문이 나타난 뒤 — 음악 권유가 본문보다 먼저 뜨지 않게
    }
    if (mode === 'reduce') {
      // 모두 즉시 끝 상태(시안 '동작 줄이기: 도장·번짐·페이드 없음')
      v.mount.setValue(1);
      v.sealOpacity.setValue(1);
      v.sealScale.setValue(1);
      feedback.fire();
      setPhase('done');
      return;
    }
    const all = Animated.parallel([
      tween(v.mount, 1, P7_T.mountFade),
      Animated.parallel([tween(v.sealScale, 1, P7_T.land, P7_T.stampAt, EASE.land), tween(v.sealOpacity, 1, P7_T.land, P7_T.stampAt, EASE.land)]),
      Animated.sequence([
        Animated.delay(P7_T.stampAt + P7_T.land),
        tween(v.squash, 0.94, P7_T.squash, 0, EASE.squash),
        tween(v.squash, 1, P7_T.squash, 0, EASE.squash),
      ]),
      Animated.sequence([
        Animated.delay(P7_T.inkAt),
        Animated.parallel([Animated.sequence([tween(v.inkOpacity, INK_FROM, 0), tween(v.inkOpacity, 0, P7_T.ink)]), tween(v.inkScale, 1.15, P7_T.ink)]),
      ]),
    ]);
    running.current.push(all);
    all.start(() => {
      if (alive.current) {
        // 끝(또는 중간에 멈춤)이면 끝 상태로 맞춘다 — 도장이 투명으로 남지 않게(네이티브 드라이버 값과 JS 값도 같아진다)
        v.mount.setValue(1);
        v.sealOpacity.setValue(1);
        v.sealScale.setValue(1);
        v.squash.setValue(1);
        v.inkOpacity.setValue(0);
        setPhase('done');
      }
    });
    // 촉각·소리는 애니메이션 끝 콜백이 아니라 타임라인 시각으로(프레임이 밀려도 도장이 닿는 때와 같게)
    timers.current.push(setTimeout(() => alive.current && feedback.fire(), P7_T.stampAt + P7_T.land));
  }, [mode, phase, feedback, v, bodyFirst]);
  // 둘째 줄: 연출 시작 뒤 700ms(시안)와 응답 도착 중 늦은 때 300ms 페이드. 동작 줄이기면 응답이 오는 즉시
  const textStarted = useRef(false);
  const [, setTextShown] = useState(false);
  useEffect(() => {
    if (mode === null || week === undefined || phase === 'wait' || textStarted.current) {
      return;
    }
    textStarted.current = true;
    const withStamp = stampWithText.current;
    if (mode === 'reduce') {
      v.text.setValue(1);
      setTextShown(true);
      if (withStamp) {
        feedback.fire();
        setPhase('done');
      }
      return;
    }
    const wait = Math.max(0, P7_T.textAt - (Date.now() - startedAt.current));
    const a = tween(v.text, 1, P7_T.text, wait);
    running.current.push(a);
    if (withStamp) {
      timers.current.push(setTimeout(() => alive.current && feedback.fire(), wait)); // 본문이 나타나기 시작하는 때
    }
    a.start(() => {
      if (alive.current) {
        v.text.setValue(1);
        setTextShown(true); // 끝 상태를 한 번 그린다(JS 값과 화면 일치)
        if (withStamp) {
          setPhase('done');
        }
      }
    });
  }, [mode, week, phase, v, feedback]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      running.current.forEach(a => a.stop());
      running.current = [];
    };
  }, []);

  const musicAvailable = music.available;
  const musicOn = music.enabled;
  useEffect(() => {
    if (phase !== 'done' || !musicAvailable || musicOn) {
      return undefined;
    }
    let on = true;
    const today = kstYmd();
    firstDoneDay
      .then(first => (first === today ? true : prefs().bgmOffered())) // V1: 처음 코스를 마친 날은 권유하지 않는다(다음 완료 때)
      .then(seen => {
        if (on && !seen) {
          prefs().markBgmOffered();
          setOffer('ask');
        }
      });
    return () => {
      on = false;
    };
  }, [phase, musicAvailable, musicOn, firstDoneDay]);

  const todayIdx = kstWeekdayIndex();
  const days = week ? stampsFromDates(week.weekStart, week.doneDates) : null;
  const firstStamp = !!days && days[todayIdx] && days.filter(Boolean).length === 1;
  // 미연결(11-7 #19): 도장은 기기에 찍히고, 가족에게는 번호를 받은 뒤부터 보인다는 것을 말한다
  // 연결(UX U5 승인, 라이터 11-9): '내일 새 사진이 와요'. 시안 보드의 '내일 또 만나요'는 U5 이전 문구라 승인 결정을 따른다.
  // TODO(푸시 0032~): 알림 상태·시각이 생기면 next_photo_time 으로
  // 5단계(기능 스위치): ⑤에서 건넨 날만 본문 첫 줄 「가족에게 건넸어요」(저장된 날 = 가족에게 실제로 보이는 날). 넘긴 날·'여기까지'로 마친 날은
  // 이 줄도 대신하는 줄도 없다 — 몇 단계 했는지 말하지 않는다(DECISIONS 5단계 화면·문구 #8)
  const passedOn = five && linked && !!content?.pass_on?.picked_key;
  const body =
    week === undefined
      ? null
      : !linked
        ? d.unlinked_body.replace('. ', '.\n')
        : `${firstStamp ? d.first_stamp : d.stamped}.\n${d.next_photo}`;
  const strip = showWeekStrip() && days ? <WeekStampStrip key="week" testID="p7-week" days={days} /> : null;
  // 「가족에게 건넸어요」는 본문과 따로 접힘 단위(#254 캡처 문제 3): 한 덩어리 3줄이면 R-15 가 통째로 밀어 첫 화면에 제목만 남았다.
  // 이 줄이 그날의 새 소식이라 제목 바로 아래(도장 줄보다 위)에 두고, 늘 같은 둘째 줄(도장·내일 사진)만 접힘 아래로 밀릴 수 있게 한다.
  // 3단계·넘긴 날·'여기까지'로 마친 날은 이 요소가 없어 묶음이 예전과 같다.
  // 요소는 처음부터 두고 글만 본문과 함께 채운다(useFoldGap 은 첫 요소 수로 잰다 — 나중에 끼우면 뒤 요소를 판정하지 않는다)
  const passed = passedOn ? (
    <Animated.View key="passed" testID="p7-passed" style={{opacity: v.text}} accessibilityLiveRegion="polite">
      {body ? <Text role="bodyLg" style={styles.center}>{d.passed_on}</Text> : null}
    </Animated.View>
  ) : null;
  // 본문 묶음(R-15 접힘 경계): 마운트 → 제목 → (건넨 줄) → 도장 줄 → 둘째 줄. 첫 요소(from 1)는 밀지 않는다.
  // 글자 1.6배 이상이면 제목 → 본문 → 마운트로 순서만 바꾼다(대기열 33, FS 200% '숨기지 말고 순서만' 선례): 마운트가 274(캡션 3줄 114)라
  // 320·360×640 에서 제목 뒤 남는 칸이 30뿐이고 본문(120~160)이 통째로 접힘 아래로 갔다. 캡션을 두 줄로 줄여도 38만 늘어 본문이 들지 않는다.
  // 이때 마운트는 R-15 대로 통째로 접힘 아래로 간다(스크롤하면 사진·도장·AI 고지가 함께 보인다)
  const mount = <AlbumMount key="mount" photoUrl={content?.photo?.image_url ?? null} large={large} motion={mountMotion(v, mode === 'full')} afterBody={bodyFirst} />;
  const items: React.ReactNode[] = [
    ...(bodyFirst ? [] : [mount]),
    // 화면 제목: 들어오면 화면 읽기 포커스를 여기로(캡션보다 먼저, PR #108 리뷰 L1)
    <View
      key="title"
      testID="p7-title"
      ref={n => {
        titleNode.current = n;
      }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={d.title}>
      <Text role="title" style={styles.center}>{d.title}</Text>
    </View>,
    ...(passed ? [passed] : []),
    ...(strip ? [strip] : []),
    <Animated.View key="text" testID="p7-text" style={{opacity: v.text}} accessibilityLiveRegion="polite">
      {body ? <Text role="bodyLg" style={styles.center}>{body}</Text> : null}
    </Animated.View>,
    ...(bodyFirst ? [mount] : []),
  ];
  const fold = useFoldGap(items.length, BODY_GAP, 1);

  const bgmDialogs = (
    <>
      <Dialog
        visible={offer === 'ask'}
        title={copy.bgm.offer_title}
        body={`${copy.bgm.offer_body}\n${copy.bgm.offer_source}`}
        actions={[
          {
            label: copy.bgm.offer_yes,
            onPress: () => {
              music.setEnabled(true);
              setOffer('preview');
            },
          },
          {label: copy.bgm.offer_no, onPress: () => setOffer('none')},
        ]}
        testID="bgm-offer"
      />
      <Dialog
        visible={offer === 'preview'}
        title={copy.bgm.preview_title}
        body={`${copy.bgm.preview_now}\n${copy.bgm.settings_sub}`}
        actions={[
          {label: copy.bgm.keep, onPress: () => setOffer('none')},
          {
            label: copy.bgm.off,
            onPress: () => {
              music.setEnabled(false);
              setOffer('none');
            },
          },
        ]}
        onBack={() => setOffer('none')}
        testID="bgm-preview"
      />
    </>
  );

  return (
    <DsScreen variant="step" dock={{primary: {label: d.button, onPress: toHome}}} onViewport={fold.onViewport} tail={music.available ? bgmDialogs : undefined}>
      <View testID="p7-stage" style={styles.body} onLayout={fold.onBlock}>
        {items.map((it, i) => (
          <View key={(it as React.ReactElement).key ?? i} testID={`p7-item-${(it as React.ReactElement).key}`} onLayout={fold.onItem(i)} style={fold.gapStyle(i)}>
            {it}
          </View>
        ))}
      </View>
    </DsScreen>
  );
}

function mountMotion(
  v: {mount: Animated.Value; sealOpacity: Animated.Value; sealScale: Animated.Value; squash: Animated.Value; inkOpacity: Animated.Value; inkScale: Animated.Value},
  withInk: boolean,
): MountMotion {
  return {
    mount: v.mount,
    seal: {opacity: v.sealOpacity, scale: v.sealScale, squash: v.squash},
    ink: withInk ? {opacity: v.inkOpacity, scale: v.inkScale} : undefined,
  };
}

const styles = StyleSheet.create({
  // 위 여백은 margin 으로(묶음 안 padding 은 useFoldGap 의 위치 계산에 들어가지 않아 접힘 판정이 어긋난다 — 에뮬레이터 실측 11-20)
  body: {gap: BODY_GAP, marginTop: ds.space.group},
  center: {textAlign: 'center'},
});
