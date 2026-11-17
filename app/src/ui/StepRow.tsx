import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
import {useReduceMotion} from './motion';
import {color, radius} from './tokens';
import {Text20} from './Text20';
import {Tape} from './assets/album';
import {Icon} from './assets/icons';

export type StepStatus = 'done' | 'now' | 'wait';
type Props = {
  title: string;
  status: StepStatus;
  statusLabel: string;
  /** 주면 행 전체가 버튼(오른쪽 '›'). 코스를 다 마친 뒤 그 단계를 보기 전용으로 다시 볼 때만 준다(시안 P3 v4 B). */
  onPress?: () => void;
  /** 방금 마친 행(코스 홈으로 돌아온 순간 한 번): 체크 원 280ms → 면 초록 200ms → '했어요' 120ms(시안 P7_motion 단계 체크) */
  justDone?: boolean;
  /** 방금 '지금 할 차례'가 된 행: 테이프가 왼쪽 8에서 미끄러져 240ms(160ms 지연) */
  tapeIn?: boolean;
};

// 명세 §7 + 시안 P3 v4 리듬 규칙(D).
// - 내용 시작 = 테두리 + 패딩 = 20 고정(지금 4+16, 다음 2+18, 했어요 0+20). 세로 패딩 16, 높이는 내용으로(최소 높이 없음).
// - 한 줄 행: 16 + 제목 24(라벨 줄 높이 32) + 16 = 64. 지금 행: 16 + 테이프 28 + 8 + 32 + 16 = 100.
// - 제목·상태는 바닥선 정렬, 좁으면 상태가 다음 줄 왼쪽으로. 줄바꿈된 행은 가운데(alignContent center).
// now: 선택 면 + 4px action + 제목 위 "지금 할 차례"(뒤에 마스킹테이프, 글자는 기울이지 않음). wait 상태 글자는 보통 굵기 inkSub.
// 동작 줄이기면 크기·이동 없이 200ms 페이드만. 진동·소리 없음(단계마다 울리면 남발).
export function StepRow({title, status, statusLabel, onPress, justDone, tapeIn}: Props) {
  const label = `${title}, ${statusLabel}`;
  if (status === 'now') {
    return (
      <View accessible accessibilityLabel={label} style={[styles.row, styles.now]}>
        <View style={styles.labelWrap}>
          {tapeIn ? (
            <TapeIn />
          ) : (
            <View style={styles.tape}>
              <Tape testID="step-tape" width={140} height={28} />
            </View>
          )}
          <Text20 weight="bold" oneLine style={styles.nowLabel}>
            {statusLabel}
          </Text20>
        </View>
        <Text20 size={24} weight="bold" oneLine style={styles.title}>
          {title}
        </Text20>
      </View>
    );
  }
  if (status === 'done' && justDone) {
    return <JustDoneRow title={title} label={label} statusLabel={statusLabel} />;
  }
  const content = (
    <>
      <Text20 size={24} weight="bold" oneLine style={[styles.title, styles.inlineTitle]}>
        {title}
      </Text20>
      {/* 상태 묶음: [체크 20](했어요) + 라벨 + [› 22](누를 수 있을 때). 아이콘은 라벨 줄 높이(28)보다 작아 행 64 를 지킨다 */}
      <View style={styles.status}>
        {status === 'done' ? <Icon name="icon-check" size={20} color={color.done} /> : null}
        <Text20 oneLine style={status === 'done' ? styles.doneLabel : styles.waitLabel}>
          {statusLabel}
        </Text20>
        {onPress ? <Icon name="icon-chevron-right" size={22} color={color.doneInk} /> : null}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({pressed}) => [styles.row, styles.inline, styles[status], pressed ? styles.pressed : null]}>
        {content}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, styles.inline, styles[status]]}>
      {content}
    </View>
  );
}
// 방금 마친 행. 끝 상태는 보통 했어요 행과 같다(누르는 '›'는 다 마친 뒤라 이 순간에는 없음).
function JustDoneRow({title, label, statusLabel}: {title: string; label: string; statusLabel: string}) {
  const reduce = useReduceMotion();
  const v = useRef({check: new Animated.Value(0), face: new Animated.Value(0), text: new Animated.Value(0)}).current;
  useEffect(() => {
    const ease = Easing.bezier(0.2, 0, 0, 1);
    const a = reduce
      ? Animated.parallel([v.check, v.face, v.text].map(x => Animated.timing(x, {toValue: 1, duration: 200, useNativeDriver: true})))
      : Animated.sequence([
          Animated.timing(v.check, {toValue: 1, duration: 280, easing: ease, useNativeDriver: true}),
          Animated.timing(v.face, {toValue: 1, duration: 200, useNativeDriver: true}),
          Animated.timing(v.text, {toValue: 1, duration: 120, useNativeDriver: true}),
        ]);
    a.start();
    return () => a.stop();
  }, [reduce, v]);
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, styles.inline, styles.wait, styles.justDone]}>
      {/* 면: 흰 면 위로 초록 면이 서서히(테두리 자리는 그대로 둬 내용 시작 20 유지) */}
      <Animated.View pointerEvents="none" style={[styles.face, {opacity: v.face}]} />
      <Text20 size={24} weight="bold" oneLine style={[styles.title, styles.inlineTitle]}>
        {title}
      </Text20>
      <View style={styles.status}>
        <Animated.View
          testID="step-check-anim"
          style={{opacity: v.check, transform: [{scale: reduce ? 1 : v.check.interpolate({inputRange: [0, 1], outputRange: [0.4, 1]})}]}}>
          <Icon name="icon-check" size={20} color={color.done} />
        </Animated.View>
        <Animated.View style={{opacity: v.text}}>
          <Text20 oneLine style={styles.doneLabel}>
            {statusLabel}
          </Text20>
        </Animated.View>
      </View>
    </View>
  );
}

function TapeIn() {
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(x, {toValue: 1, duration: reduce ? 200 : 240, delay: reduce ? 0 : 160, useNativeDriver: true});
    a.start();
    return () => a.stop();
  }, [reduce, x]);
  return (
    <Animated.View
      testID="step-tape-anim"
      style={[styles.tape, {opacity: x, transform: [{rotate: '-2deg'}, {translateX: reduce ? 0 : x.interpolate({inputRange: [0, 1], outputRange: [-8, 0]})}]}]}>
      <Tape testID="step-tape" width={140} height={28} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {borderRadius: radius.card, paddingVertical: 16},
  inline: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', alignContent: 'center', columnGap: 12},
  inlineTitle: {flexShrink: 1, marginRight: 'auto'},
  done: {backgroundColor: color.doneSoft, borderWidth: 0, paddingHorizontal: 20},
  now: {backgroundColor: color.actionSoft, borderWidth: 4, borderColor: color.action, paddingHorizontal: 16, gap: 8},
  wait: {backgroundColor: color.card, borderWidth: 2, borderColor: color.line, paddingHorizontal: 18},
  pressed: {opacity: 0.85},
  title: {color: color.inkTitle},
  labelWrap: {alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10},
  tape: {position: 'absolute', left: -6, top: 0, transform: [{rotate: '-2deg'}]},
  nowLabel: {color: color.actionPressed},
  doneLabel: {color: color.doneInk, fontWeight: 'bold'},
  waitLabel: {color: color.inkSub},
  status: {flexDirection: 'row', alignItems: 'center', gap: 6},
  // 방금 마친 행: 처음엔 '다음 차례'처럼 흰 면(테두리 2 + 패딩 18 = 20), 그 위에 초록 면이 덮인다
  justDone: {overflow: 'hidden', borderColor: 'transparent'},
  face: {...StyleSheet.absoluteFill, backgroundColor: color.doneSoft},
});
