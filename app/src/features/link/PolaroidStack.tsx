import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, Image, StyleSheet, View} from 'react-native';
import {color} from '../../ui/tokens';
import {assetRegistry} from '../../ui/assets/registry';
import {Tape} from '../../ui/assets/album';
import {copy} from '../../copy/copy';
import type {MotionMode} from './useReduceMotion';
import {FRONT_DEG, PAD, StackLayout} from './polaroidLayout';

const STD = Easing.bezier(0.4, 0, 0.2, 1);
const DEVELOP = Easing.bezier(0, 0, 0.2, 1);

// 첫 화면 "앨범 펼침"(FS_D): 앞 사진 1장 + 뒤 2장 부채꼴, 테이프. 캡션·AI 표시 없음(사용자 결정).
// 모션은 처음 한 번(NOTES-redesign 표): 앞 사진 내려앉음 → 뒤 2장 펼침, 앞 사진 인화(덮개가 걷힘).
// 동작 줄이기면 움직임·회전 없이 300ms 페이드만, 스크린리더·두 번째부터는 끝 상태. 뒤 사진은 처음부터 펼친 자리.
// mode: 'full' 모션, 'reduce' 300ms 페이드, 'none' 끝 상태로 바로(스크린리더·이미 한 번 재생함). null 이면 아직 시작 안 함.
export function PolaroidStack({lay, mode}: {lay: StackLayout; mode: MotionMode | null}) {
  const done = mode === 'none';
  const front = useRef(new Animated.Value(done ? 1 : 0)).current; // 0→1 진행
  const left = useRef(new Animated.Value(done ? 1 : 0)).current;
  const right = useRef(new Animated.Value(done ? 1 : 0)).current;
  const cover = useRef(new Animated.Value(done ? 0 : 1)).current; // 인화 덮개
  const started = useRef(false);
  // 근본 원인(실기기 17-first-D): 이 묶음은 영역을 잰 뒤 처음 마운트되는데, 마운트와 같은 커밋의 useEffect 에서
  // 네이티브 드라이버 애니메이션을 시작하면 새 아키텍처에서 네이티브 뷰가 아직 붙지 않아 값이 적용되지 않고
  // JS 쪽 초기값(투명 0)이 남았다(로그상 영역·크기·mode 는 정상). 그래서 묶음 자신의 onLayout(네이티브 뷰가
  // 실제로 붙고 배치된 뒤)을 받은 다음에 시작한다. 이미 마운트되어 있던 소개 줄 애니메이션은 정상이었다.
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const settle = useCallback(() => {
    [front, left, right].forEach(v => v.setValue(1));
    cover.setValue(0);
  }, [front, left, right, cover]);

  // 안전장치(정상 경로에서는 발동하지 않음): 2.5초 안에 시작하지 못하면 끝 상태로 보여 준다(사진이 투명하게 남지 않게)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!started.current) {
        started.current = true;
        settle();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [settle]);

  useEffect(() => {
    if (!ready || mode === null || started.current) {
      return;
    }
    started.current = true;
    if (mode === 'none') {
      settle();
      return;
    }
    // 끝까지 가지 못하고 멈추면(화면 이동 등) 끝 상태로 맞춘다
    const end = ({finished}: {finished: boolean}) => {
      if (!finished) {
        settle();
      }
    };
    const t = (v: Animated.Value, to: number, duration: number, delay: number, easing = STD) =>
      Animated.timing(v, {toValue: to, duration, delay, easing, useNativeDriver: true});
    if (mode === 'reduce') {
      Animated.parallel([t(front, 1, 300, 0), t(left, 1, 300, 0), t(right, 1, 300, 0), t(cover, 0, 300, 0)]).start(end);
      return;
    }
    Animated.parallel([
      t(front, 1, 450, 200),
      t(left, 1, 450, 520),
      t(right, 1, 450, 580),
      t(cover, 0, 500, 450, DEVELOP), // 인화는 짧게(리뷰: 1.2초는 사진이 늦게 뜨는 것처럼 보임)
    ]).start(end);
  }, [ready, mode, front, left, right, cover, settle]);

  const still = mode !== 'full'; // 동작 줄이기·끝 상태: 자리·회전 고정, 투명도만
  const backStyle = (v: Animated.Value, side: -1 | 1) => {
    const deg = side < 0 ? -lay.rotL : lay.rotR;
    return {
      opacity: v,
      transform: [
        {translateX: still ? side * lay.dx : v.interpolate({inputRange: [0, 1], outputRange: [0, side * lay.dx]})},
        {translateY: lay.dy},
        {rotate: still ? `${deg}deg` : v.interpolate({inputRange: [0, 1], outputRange: [`-${FRONT_DEG}deg`, `${deg}deg`]})},
      ],
    };
  };
  const frameSize = {width: lay.frameW, height: lay.frameH};
  const photoSize = {width: lay.photoW, height: lay.photoH};

  return (
    <View
      testID="polaroid-stack"
      onLayout={onReady}
      style={[styles.box, {width: lay.totalW, height: lay.totalH}]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={copy.first.polaroid_a11y}>
      {lay.single ? null : (
      <Animated.View style={[styles.frame, styles.back, frameSize, backStyle(left, -1)]}>
        <Image testID="intro-photo-back-left" source={assetRegistry['intro-photo-back-left']!} style={[styles.photo, photoSize]} resizeMode="cover" />
      </Animated.View>
      )}
      {lay.single ? null : (
      <Animated.View style={[styles.frame, styles.back, frameSize, backStyle(right, 1)]}>
        <Image testID="intro-photo-back-right" source={assetRegistry['intro-photo-back-right']!} style={[styles.photo, photoSize]} resizeMode="cover" />
      </Animated.View>
      )}
      <Animated.View
        testID="intro-front-frame"
        style={[
          styles.frame,
          styles.front,
          frameSize,
          {
            opacity: front,
            transform: [
              {translateY: still ? 0 : front.interpolate({inputRange: [0, 1], outputRange: [-20, 0]})},
              {scale: still ? 1 : front.interpolate({inputRange: [0, 1], outputRange: [1.04, 1]})},
              {rotate: `-${FRONT_DEG}deg`},
            ],
          },
        ]}>
        <View style={styles.tape} pointerEvents="none">
          <Tape width={Math.round(lay.frameW * 0.42)} height={lay.tape >= 12 ? 22 : 16} />
        </View>
        <View>
          <Image testID="intro-photo" source={assetRegistry['intro-photo']!} style={[styles.photo, photoSize]} resizeMode="cover" />
          <Animated.View pointerEvents="none" style={[styles.cover, photoSize, {opacity: cover}]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {alignItems: 'center', justifyContent: 'center'},
  // 종이 사진 느낌: 틀 반경 3, 사진 반경 0. 틀 아래 흰 띠(캡션 없음)
  frame: {position: 'absolute', backgroundColor: color.card, paddingTop: PAD, paddingHorizontal: PAD, borderRadius: 3},
  front: {boxShadow: '0px 6px 14px rgba(92,78,51,0.28)'},
  back: {boxShadow: '0px 3px 10px rgba(116,72,33,0.20)'},
  photo: {borderRadius: 0, backgroundColor: color.paperSoft},
  cover: {position: 'absolute', top: 0, left: 0, backgroundColor: color.paperSoft},
  tape: {position: 'absolute', top: -10, alignSelf: 'center', zIndex: 1, transform: [{rotate: '3deg'}]},
});
