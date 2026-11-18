import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useBackAction} from '../../app/BackBar';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, space} from '../../ui/tokens';
import {copy} from '../../copy/copy';
import {StampRow} from './StampRow';
import {kstWeekdayIndex, stampsFromDates} from './stamps';
import {SunStamp} from '../../ui/assets/album';
import {useWeekStamps} from './useWeekStamps';
import {useMotionMode} from '../../ui/motion';
import {newStampFeedback} from './stampFeedback';
import {prefs} from '../../lib/prefs';
import {Dialog} from '../../ui/Dialog';
import {useCourseBgm} from './useCourseBgm';

const d = copy.done;
const BIG = 120; // 큰 도장 지름(시안 P7_motion, 오늘 칸 도장 40으로 줄어 앉는다)
const INK = BIG + 24; // 인주 번짐 지름(시안 inset −12)
const WEEK_WAIT_MS = 1500;

// 타임라인(시안 P7_motion "소리·촉각·타임라인", 약 1.4초)
export const P7_T = {land: 180, squash: 140, inkAt: 220, ink: 420, textAt: 500, text: 200, flyAt: 900, fly: 480, fade: 200} as const;
// 이징(시안 CSS cubic-bezier 그대로)
const EASE = {
  land: Easing.bezier(0.3, 0, 0.8, 0.15),
  squash: Easing.bezier(0.2, 0.8, 0.2, 1),
  fly: Easing.bezier(0.4, 0, 0.2, 1),
};

type Node = React.ComponentRef<typeof View>;
export type Box = {x: number; y: number; w: number; h: number};
// 화면 위 위치 재기. 측정이 안 되는 환경이면 100ms 뒤 null(날지 않고 사라진다). 테스트는 setMeasureForTest 로 바꾼다.
const measureInWindow = (n: Node | null, alive: () => boolean) =>
  new Promise<Box | null>(resolve => {
    const timer = setTimeout(() => resolve(null), 100);
    try {
      n?.measureInWindow((x, y, w, h) => {
        clearTimeout(timer);
        resolve(alive() && w > 0 ? {x, y, w, h} : null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
let measureNode = measureInWindow;
export function setMeasureForTest(f: typeof measureInWindow | null) {
  measureNode = f ?? measureInWindow;
}

// P7 코스 완료(시안 P7_done + P7_motion). 3/3을 마친 직후 한 번, "알겠어요"(·뒤로가기)로 코스 홈으로.
// - 도장 '쾅'(맨 위 120 칸 안): 1.3·투명 → 180ms 1.0(이때 촉각 1회·도장 소리) → 140ms 세로 0.94 눌림 → 220ms부터 인주 번짐
//   420ms → 500ms 제목·문구 200ms 페이드 → 900ms 이번 주 오늘 칸으로 480ms. 화면을 누르면 바로 끝 상태.
//   '화면을 누르면 바로 넘어가요'는 첫 1회, 하단 독(버튼 아래)에 둬 사라져도 본문이 움직이지 않는다.
// - 동작 줄이기·화면 읽기: 크기·이동 없이 120 도장이 제자리에서, 제목·문구와 함께 200ms 페이드. 오늘 칸은 이미 찍힌 상태.
//   소리·촉각은 유지(움직임이 아님). 판정 전(첫 프레임)에는 아무 모션도 시작하지 않는다.
// - 다 끝나면 맨 위 칸은 비운다(완료 해님 없음, 디자인 결정 11-18). 칸 높이는 남겨 본문이 움직이지 않는다.
// - 미연결도 같은 연출(도장은 기기에 찍힘, 11-7 #19). 칭찬·연속·하트 없음.
export function CourseDone({navigation}: NativeStackScreenProps<ParentParams, 'CourseDone'>) {
  const {api, content} = useSession();
  const linked = !!content?.linked;
  const fetched = useWeekStamps(api, content ? content.linked : undefined, 'done');
  // 이번 주 도장 응답이 1.5초 안에 오지 않으면 도장 줄 없이 진행(제목·문구가 투명으로 고착되지 않게, 리뷰 후속)
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
  // AP-04 첫 완료 1회 권유(시안 PX_music): 연출이 끝난 뒤 '음악을 틀어 드릴까요?' → 들어 볼게요면 켜고 미리 듣기 상자.
  // 음원(CT-04)이 없거나 화면 읽기 켜짐이면 묻지 않는다. 한 번 보이면 다시 묻지 않는다(prefs bgmOffered)
  const music = useCourseBgm('done');
  const [offer, setOffer] = useState<'none' | 'ask' | 'preview'>('none');
  useBackAction(toHome);

  const feedback = useRef(newStampFeedback()).current;
  const [phase, setPhase] = useState<'wait' | 'run' | 'done'>('wait');
  const [hint, setHint] = useState(false); // 안내 줄 자리(첫 1회). 한 번 생기면 자리는 남긴다
  const v = useRef({
    scale: new Animated.Value(1.3),
    opacity: new Animated.Value(0),
    squash: new Animated.Value(1),
    ink: new Animated.Value(0),
    text: new Animated.Value(0),
    tx: new Animated.Value(0),
    ty: new Animated.Value(0),
    fly: new Animated.Value(1),
  }).current;
  const bigRef = useRef<Node>(null);
  const cellRef = useRef<Node>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const running = useRef<Animated.CompositeAnimation[]>([]);
  const alive = useRef(true);
  const start = (a: Animated.CompositeAnimation, end?: () => void) => {
    running.current.push(a);
    a.start(({finished}) => finished && alive.current && end?.());
  };

  const toDone = useCallback(() => {
    if (!alive.current) {
      return;
    }
    setPhase('done');
  }, []);

  const finishNow = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    running.current.forEach(a => a.stop());
    running.current = [];
    feedback.fire(); // 건너뛰어도 한 번은 울린다(이미 울렸으면 다시 울리지 않음)
    v.text.setValue(1);
    toDone();
  }, [feedback, v, toDone]);

  useEffect(() => {
    if (mode === null || week === undefined || phase !== 'wait') {
      return;
    }
    setPhase('run');
    if (mode === 'reduce') {
      feedback.fire();
      start(
        Animated.parallel([
          Animated.timing(v.opacity, {toValue: 1, duration: P7_T.fade, useNativeDriver: true}),
          Animated.timing(v.text, {toValue: 1, duration: P7_T.fade, useNativeDriver: true}),
        ]),
        () => setPhase('done'), // 줄이기는 120 도장이 제자리에 남는다(해님으로 바꾸지 않음)
      );
      v.scale.setValue(1);
      return;
    }
    prefs()
      .skipHintSeen()
      .then(seen => {
        if (!seen && alive.current) {
          setHint(true);
          prefs().markSkipHintSeen();
        }
      });
    const land = Animated.parallel([
      Animated.timing(v.scale, {toValue: 1, duration: P7_T.land, easing: EASE.land, useNativeDriver: true}),
      Animated.timing(v.opacity, {toValue: 1, duration: P7_T.land, easing: EASE.land, useNativeDriver: true}),
    ]);
    const press = Animated.sequence([
      Animated.timing(v.squash, {toValue: 0.94, duration: P7_T.squash / 2, easing: EASE.squash, useNativeDriver: true}),
      Animated.timing(v.squash, {toValue: 1, duration: P7_T.squash / 2, easing: EASE.squash, useNativeDriver: true}),
    ]);
    start(land);
    // 단계 전환은 애니메이션 끝 콜백이 아니라 타임라인 시각으로(프레임이 밀려도 촉각·이동 시점이 시안과 같게)
    timers.current.push(
      setTimeout(() => {
        feedback.fire(); // 도장이 닿는 180ms: 촉각 1회 + 소리
        start(press);
      }, P7_T.land),
    );
    start(Animated.timing(v.ink, {toValue: 1, duration: P7_T.ink, delay: P7_T.inkAt, useNativeDriver: true}));
    start(Animated.timing(v.text, {toValue: 1, duration: P7_T.text, delay: P7_T.textAt, useNativeDriver: true}));
    timers.current.push(
      setTimeout(async () => {
        const isAlive = () => alive.current;
        const [from, to] = await Promise.all([measureNode(bigRef.current, isAlive), measureNode(cellRef.current, isAlive)]);
        if (!alive.current || running.current.length === 0) {
          return; // 그 사이 닫혔거나 건너뛰었다
        }
        const t = (val: Animated.Value, toValue: number) =>
          Animated.timing(val, {toValue, duration: P7_T.fly, easing: EASE.fly, useNativeDriver: true});
        const anim =
          from && to
            ? Animated.parallel([
                t(v.tx, to.x + to.w / 2 - (from.x + from.w / 2)),
                t(v.ty, to.y + to.h / 2 - (from.y + from.h / 2)),
                t(v.fly, to.w / from.w),
              ])
            : Animated.timing(v.opacity, {toValue: 0, duration: P7_T.fade, useNativeDriver: true});
        start(anim);
        timers.current.push(setTimeout(toDone, from && to ? P7_T.fly : P7_T.fade));
      }, P7_T.flyAt),
    );
  }, [mode, week, phase, feedback, v, toDone]);

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
    let alive = true;
    prefs()
      .bgmOffered()
      .then(seen => {
        if (alive && !seen) {
          prefs().markBgmOffered();
          setOffer('ask');
        }
      });
    return () => {
      alive = false;
    };
  }, [phase, musicAvailable, musicOn]);

  const todayIdx = kstWeekdayIndex();
  const days = week ? stampsFromDates(week.weekStart, week.doneDates) : null;
  const firstStamp = !!days && days[todayIdx] && days.filter(Boolean).length === 1;
  // 미연결(11-7 #19): 도장은 기기에 찍히고, 가족에게는 번호를 받은 뒤부터 보인다는 것을 말한다
  // 연결(UX U5, 라이터 11-9): 알림 켜짐이면 '내일 {시각}에 새 사진을 알려 드려요', 꺼짐·알림 기능 없음이면 '내일 새 사진이 와요'.
  // TODO(푸시 0032~): 알림 상태·시각이 생기면 next_photo_time 으로. 지금은 알림 기능이 없어 항상 next_photo. 미연결(11-7 #19)은 그대로
  const body =
    week === undefined
      ? null
      : !linked
        ? d.unlinked_body.replace('. ', '.\n')
        : `${firstStamp ? d.first_stamp : d.stamped}.\n${d.next_photo}`;
  const full = mode === 'full';
  const bigShown = mode === 'reduce' || (full && phase !== 'done');

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
    <Screen
      bottom={
        <>
          <BigButton label={d.button} onPress={toHome} />
          {/* 첫 1회 건너뛰기 안내: 하단 독(시안). 연출이 끝나도 자리는 그대로(글자만 투명) — 본문이 움직이지 않는다 */}
          {hint ? (
            <Text20 testID="p7-skip-hint" style={[styles.hint, phase === 'run' ? null : styles.gone]}>
              {d.skip_hint}
            </Text20>
          ) : null}
        </>
      }>
      {/* 화면 어디를 눌러도 끝 상태로(건너뛰기). 화면 읽기에는 따로 읽히지 않는다 */}
      <Pressable testID="p7-stage" accessible={false} onPress={full && phase === 'run' ? finishNow : undefined} style={styles.center}>
        {/* 맨 위 120 칸: 도장 '쾅'(장식, 읽지 않음) → 끝나면 완료 해님 */}
        <View style={styles.slot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {bigShown ? (
            <Animated.View
              ref={bigRef}
              testID="p7-stamp-big"
              style={[
                styles.big,
                {
                  opacity: v.opacity,
                  transform: [{translateX: v.tx}, {translateY: v.ty}, {scale: Animated.multiply(v.scale, v.fly)}, {scaleY: v.squash}],
                },
              ]}>
              {full ? (
                <Animated.View
                  testID="p7-ink"
                  style={[
                    styles.ink,
                    {
                      opacity: v.ink.interpolate({inputRange: [0, 0.01, 1], outputRange: [0, 0.35, 0]}),
                      transform: [{scale: v.ink.interpolate({inputRange: [0, 1], outputRange: [0.9, 1.15]})}],
                    },
                  ]}
                />
              ) : null}
              <SunStamp variant={todayIdx} size={BIG} />
            </Animated.View>
          ) : null}
        </View>
        {/* 감사 M9·디자인 판정(리드 승인, 시안 P7_motion 수정): 제목은 첫 프레임부터 보인다. 페이드는 둘째 줄만 */}
        <View style={styles.textGroup}>
          <Text20 testID="p7-title" size={32} weight="bold" accessibilityRole="header" style={styles.text}>{d.title}</Text20>
          <Animated.View testID="p7-text" style={{opacity: v.text}}>
            {body ? (
              <Text20 size={22} weight="bold" style={styles.text} accessibilityLiveRegion="polite">{body}</Text20>
            ) : null}
          </Animated.View>
        </View>
        {days ? (
          <StampRow days={days} todayIdx={todayIdx} hideIdx={full && phase !== 'done' ? todayIdx : undefined} cellRef={cellRef} />
        ) : null}
      </Pressable>
      {music.available ? bgmDialogs : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {flexGrow: 1, alignItems: 'stretch', justifyContent: 'center', gap: space.lg},
  slot: {height: BIG, marginTop: space.xl + 4, alignItems: 'center', justifyContent: 'center'},
  textGroup: {gap: space.sm},
  text: {textAlign: 'center', alignSelf: 'center'},
  hint: {textAlign: 'center', color: color.inkSub},
  gone: {opacity: 0},
  big: {width: BIG, height: BIG, alignItems: 'center', justifyContent: 'center'},
  // 인주 번짐: 도장 뒤 원이 퍼지며 옅어진다(220ms 전에는 투명)
  ink: {position: 'absolute', width: INK, height: INK, borderRadius: INK / 2, backgroundColor: color.brandSealDeep},
});
