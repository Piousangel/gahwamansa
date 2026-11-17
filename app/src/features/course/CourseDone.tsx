import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useBackAction} from '../../app/BackBar';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color} from '../../ui/tokens';
import {copy} from '../../copy/copy';
import {StampRow} from './StampRow';
import {kstWeekdayIndex, stampsFromDates} from './stamps';
import {Sun} from '../../ui/assets/sun';
import {SunStamp} from '../../ui/assets/album';
import {useWeekStamps} from './useWeekStamps';
import {useMotionPref} from './useMotionPref';
import {newStampFeedback} from './stampFeedback';
import {prefs} from '../../lib/prefs';

const d = copy.done;
const BIG = 120; // 큰 도장 지름(오늘 칸 도장 40으로 줄어 앉는다)

// 타임라인(시안 P7_motion, 약 1.4초)
export const P7_T = {land: 180, squash: 140, inkAt: 220, ink: 420, textAt: 500, text: 200, flyAt: 900, fly: 480, fade: 200} as const;

type Node = React.ComponentRef<typeof View>;
const measure = (n: Node | null) =>
  new Promise<{x: number; y: number; w: number; h: number} | null>(resolve => {
    const done = setTimeout(() => resolve(null), 100); // 측정이 안 되는 환경(테스트 등)이면 날지 않고 사라진다
    try {
      n?.measureInWindow((x, y, w, h) => {
        clearTimeout(done);
        resolve(w > 0 ? {x, y, w, h} : null);
      });
    } catch {
      clearTimeout(done);
      resolve(null);
    }
  });

// P7 코스 완료(시안 P7_done + P7_motion). 3/3을 마친 직후 한 번, "알겠어요"(·뒤로가기)로 코스 홈으로.
// - 도장 '쾅': 1.3·투명 → 180ms 1.0(이때 촉각 1회·도장 소리) → 140ms 세로 0.94 눌림 → 220ms부터 인주 번짐 420ms
//   → 500ms 문구 200ms 페이드 → 900ms 이번 주 오늘 칸으로 480ms. 화면을 누르면 바로 끝 상태(첫 1회 안내).
// - 동작 줄이기·화면 읽기: 크기·이동 없이 오늘 칸 도장·문구 200ms 페이드. 소리·촉각은 유지(움직임이 아님).
// - 미연결도 같은 연출(도장은 기기에 찍힘, 11-7 #19). 칭찬·연속·하트 없음.
export function CourseDone({navigation}: NativeStackScreenProps<ParentParams, 'CourseDone'>) {
  const {api, content} = useSession();
  const linked = !!content?.linked;
  const week = useWeekStamps(api, content ? content.linked : undefined, 'done');
  const mode = useMotionPref();
  const toHome = () => navigation.popTo('CourseHome');
  useBackAction(toHome);

  const feedback = useRef(newStampFeedback()).current;
  const [phase, setPhase] = useState<'wait' | 'run' | 'done'>('wait');
  const [hint, setHint] = useState(false);
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

  const finishNow = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    running.current.forEach(a => a.stop());
    running.current = [];
    feedback.fire(); // 건너뛰어도 한 번은 울린다(이미 울렸으면 다시 울리지 않음)
    v.text.setValue(1);
    setPhase('done');
  }, [feedback, v]);

  useEffect(() => {
    if (mode === null || week === undefined || phase !== 'wait') {
      return;
    }
    setPhase('run');
    if (mode === 'reduce') {
      feedback.fire();
      const a = Animated.timing(v.text, {toValue: 1, duration: P7_T.fade, useNativeDriver: true});
      running.current.push(a);
      a.start(() => setPhase('done'));
      return;
    }
    // 첫 1회만 건너뛰기 안내
    prefs()
      .skipHintSeen()
      .then(seen => {
        if (!seen) {
          setHint(true);
          prefs().markSkipHintSeen();
        }
      });
    const land = Animated.parallel([
      Animated.timing(v.scale, {toValue: 1, duration: P7_T.land, easing: Easing.in(Easing.quad), useNativeDriver: true}),
      Animated.timing(v.opacity, {toValue: 1, duration: P7_T.land, easing: Easing.in(Easing.quad), useNativeDriver: true}),
    ]);
    const press = Animated.sequence([
      Animated.timing(v.squash, {toValue: 0.94, duration: P7_T.squash / 2, useNativeDriver: true}),
      Animated.timing(v.squash, {toValue: 1, duration: P7_T.squash / 2, useNativeDriver: true}),
    ]);
    const ink = Animated.timing(v.ink, {toValue: 1, duration: P7_T.ink, delay: P7_T.inkAt, useNativeDriver: true});
    const text = Animated.timing(v.text, {toValue: 1, duration: P7_T.text, delay: P7_T.textAt, useNativeDriver: true});
    running.current.push(land, press, ink, text);
    land.start(({finished}) => {
      if (finished) {
        feedback.fire(); // 도장이 닿는 180ms: 촉각 1회 + 소리
        press.start();
      }
    });
    ink.start();
    text.start();
    timers.current.push(
      setTimeout(async () => {
        const [from, to] = await Promise.all([measure(bigRef.current), measure(cellRef.current)]);
        const anim =
          from && to
            ? Animated.parallel([
                Animated.timing(v.tx, {toValue: to.x + to.w / 2 - (from.x + from.w / 2), duration: P7_T.fly, easing: Easing.inOut(Easing.cubic), useNativeDriver: true}),
                Animated.timing(v.ty, {toValue: to.y + to.h / 2 - (from.y + from.h / 2), duration: P7_T.fly, easing: Easing.inOut(Easing.cubic), useNativeDriver: true}),
                Animated.timing(v.fly, {toValue: to.w / from.w, duration: P7_T.fly, easing: Easing.inOut(Easing.cubic), useNativeDriver: true}),
              ])
            : Animated.timing(v.opacity, {toValue: 0, duration: P7_T.fade, useNativeDriver: true});
        running.current.push(anim);
        anim.start(({finished}) => finished && setPhase('done'));
      }, P7_T.flyAt),
    );
  }, [mode, week, phase, feedback, v]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      running.current.forEach(a => a.stop());
    },
    [],
  );

  const todayIdx = kstWeekdayIndex();
  const days = week ? stampsFromDates(week.weekStart, week.doneDates) : null;
  const firstStamp = !!days && days[todayIdx] && days.filter(Boolean).length === 1;
  // 미연결(11-7 #19): 도장은 기기에 찍히고, 가족에게는 번호를 받은 뒤부터 보인다는 것을 말한다
  const body =
    week === undefined ? null : !linked ? d.unlinked_body.replace('. ', '.\n') : firstStamp ? d.first_stamp : d.body.replace('. ', '.\n');
  const full = mode === 'full';
  const flying = full && phase !== 'done';

  return (
    <Screen bottom={<BigButton label={d.button} onPress={toHome} />}>
      {/* 화면 어디를 눌러도 끝 상태로(건너뛰기). 화면 읽기에는 따로 읽히지 않는다 */}
      <Pressable testID="p7-stage" accessible={false} onPress={phase === 'run' ? finishNow : undefined} style={styles.center}>
        <View style={styles.sun}>
          <Sun art="sun-happy" size={88} />
        </View>
        <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.text}>{d.title}</Text20>
        {days ? (
          <StampRow
            days={days}
            todayIdx={todayIdx}
            hideIdx={flying ? todayIdx : undefined}
            cellRef={cellRef}
            appearIdx={mode === 'reduce' ? todayIdx : undefined}
            fadeMs={P7_T.fade}
          />
        ) : null}
        {body ? (
          <Animated.View style={{opacity: v.text}}>
            <Text20 size={22} weight="bold" style={styles.text} accessibilityLiveRegion="polite">{body}</Text20>
          </Animated.View>
        ) : null}
        {hint && phase === 'run' ? <Text20 style={styles.hint}>{d.skip_hint}</Text20> : null}
        {flying ? (
          // 큰 도장(장식, 읽지 않음): 화면 위쪽 가운데에서 '쾅' → 오늘 칸으로
          <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
              <Animated.View
                style={[
                  styles.ink,
                  {
                    opacity: v.ink.interpolate({inputRange: [0, 1], outputRange: [0.35, 0]}),
                    transform: [{scale: v.ink.interpolate({inputRange: [0, 1], outputRange: [0.8, 1.6]})}],
                  },
                ]}
              />
              <SunStamp variant={todayIdx} size={BIG} />
            </Animated.View>
          </View>
        ) : null}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {flexGrow: 1, alignItems: 'stretch', justifyContent: 'center', gap: 16},
  text: {textAlign: 'center', alignSelf: 'center'},
  sun: {alignItems: 'center'},
  hint: {textAlign: 'center', color: color.ink},
  overlay: {position: 'absolute', left: 0, right: 0, top: 96, alignItems: 'center'},
  big: {width: BIG, height: BIG, alignItems: 'center', justifyContent: 'center'},
  // 인주 번짐: 도장 뒤 살구빛 원이 퍼지며 옅어진다
  ink: {position: 'absolute', width: BIG, height: BIG, borderRadius: BIG / 2, backgroundColor: color.blush},
});
