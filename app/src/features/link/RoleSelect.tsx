import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, LayoutChangeEvent, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {color} from '../../ui/tokens';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {Icon, IconName} from '../../ui/assets/icons';
import {copy} from '../../copy/copy';
import {RoleChoiceButton} from './RoleChoiceButton';
import {stackLayout} from './polaroidLayout';
import {PolaroidStack} from './PolaroidStack';
import {MotionMode, useMotionMode} from './useReduceMotion';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {flightPending, setSplashTarget, useSplashLanded} from '../../app/splash';

const f = copy.first;
const ICONS: IconName[] = ['icon-photo', 'icon-pencil', 'icon-family'];
// 아이콘 원(장식, 색만으로 정보를 전하지 않음): 사진 노랑, 연필 하늘(한글 쓰기 단계와 같은 색), 가족 복숭아
const CIRCLE = [color.accentSun, color.sky, color.accentPeach];
const STD = Easing.bezier(0.4, 0, 0.2, 1);
const POP = Easing.bezier(0.2, 0.8, 0.2, 1);

// 의미 단위 줄바꿈: 마지막 세 어절을 붙여 "가요"만 다음 줄로 넘어가지 않게 한다
// ("고른 답으로 자녀가 / 취향을 알아 가요"). 한 줄에 들어가면 그대로 한 줄.
export const keepTail = (t: string) => {
  const w = t.split(' ');
  return w.length < 4 ? t : `${w.slice(0, -3).join(' ')} ${w.slice(-3).join(' ')}`;
};

// 첫 화면(FS_D "앨범 펼침"). 위 심볼+워드마크, 소개(제목 + 색 원 아이콘 항목 3줄), 가운데 사진 3장 묶음(캡션·AI 표시 없음),
// 아래 고정 영역에 질문과 버튼 2개(첫 화면은 하단 40% 규칙 예외). 해님 말 없음. 이전 바 없음.
// 본문은 스크롤하지 않는 한 화면. 사진 묶음은 남은 영역(onLayout, 묶음이 영역을 밀지 않게 띄움) 안에 전체가 들어가게 계산하고,
// 안 들어가면 숨긴다. 글자 130%면 사진을 숨기고 하단 높이 상한을 없애며, 150%면 소개(제목·항목)도 숨기고,
// 그래도 하단이 넘치면 고정을 풀고 화면 전체 스크롤.
// 모션은 영역을 잰 뒤 앱 실행당 한 번(RN Animated, 네이티브 드라이버). 버튼은 처음부터 누를 수 있다.
// 동작 줄이기면 300ms 페이드만, 스크린리더가 켜져 있거나 두 번째부터는 끝 상태로 바로.
// 첫 화면 모션은 앱 실행당 한 번만. 다른 화면에 갔다가 돌아오면 끝 상태로 보여 준다.
let firstScreenPlayed = false;
export const resetFirstScreenMotion = () => {
  firstScreenPlayed = false;
};

export function RoleSelect({onChoose}: {onChoose: (role: 'parent' | 'child') => void}) {
  const {height: winH, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const showPhoto = fontScale < 1.3;
  const showIntro = fontScale < 1.5; // 150% 이상이면 소개(제목·항목)도 숨겨 버튼을 지킨다
  const replay = useRef(firstScreenPlayed).current;
  // 스플래시 심볼이 날아와 앉을 자리: 도착 전에는 진짜 심볼을 숨기고, 워드마크 줄은 위로 떠오르지 않는다(위치가 어긋나지 않게)
  const fromSplash = useRef(flightPending()).current;
  const landed = useSplashLanded();
  const symbolRef = useRef<React.ComponentRef<typeof View>>(null);
  const onSymbolLayout = () => {
    if (fromSplash) {
      symbolRef.current?.measureInWindow((x, y, w) => w > 0 && setSplashTarget({x, y, size: w}));
    }
  };
  const detected = useMotionMode();
  const reduce: MotionMode | null = replay ? 'none' : detected;
  // 큰 글씨에서 하단 영역(질문+버튼)이 화면에 다 안 들어가면 고정을 풀고 화면 전체를 스크롤한다
  const [fullScroll, setFullScroll] = useState(false);
  const onDockContent = (e: LayoutChangeEvent) => {
    const avail = winH - insets.top - insets.bottom - 16 - 12 - 80; // 위 워드마크 줄·여백을 뺀 높이
    if (e.nativeEvent.layout.height > avail) {
      setFullScroll(true);
    }
  };
  const [area, setArea] = useState<{w: number; h: number} | null>(null);
  const onArea = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setArea(a => (a && a.w === width && a.h === height ? a : {w: width, h: height}));
  };
  const lay = showPhoto && area ? stackLayout(area.w, area.h) : null;
  const measured = area !== null || fullScroll; // 모션은 영역을 잰 뒤 시작(px 위치 계산 때문)
  const mode: MotionMode | null = measured ? reduce : null;

  // 등장 모션 값(0→1). 심볼 1개 + 항목 3줄 + 아이콘 원 3개
  const symbol = useRef(new Animated.Value(0)).current;
  const items = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const circles = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const started = useRef(false);
  useEffect(() => {
    if (mode === null || started.current) {
      return;
    }
    started.current = true;
    firstScreenPlayed = true;
    if (mode === 'none') {
      [symbol, ...items, ...circles].forEach(v => v.setValue(1));
      return;
    }
    const t = (v: Animated.Value, duration: number, delay: number, easing = STD) =>
      Animated.timing(v, {toValue: 1, duration, delay, easing, useNativeDriver: true});
    if (mode === 'reduce') {
      Animated.parallel([symbol, ...items, ...circles].map(v => t(v, 300, 0))).start();
      return;
    }
    Animated.parallel([
      t(symbol, 450, 0),
      ...items.map((v, i) => t(v, 300, [150, 270, 390][i])),
      ...circles.map((v, i) => t(v, 300, [150, 230, 310][i], POP)),
    ]).start();
  }, [mode, symbol, items, circles]);
  const still = mode !== 'full';
  const rise = (v: Animated.Value, from: number) => (still ? 0 : v.interpolate({inputRange: [0, 1], outputRange: [from, 0]}));
  const brandRise = fromSplash ? 0 : rise(symbol, 8);
  const brandOpacity = fromSplash ? 1 : symbol;

  const ask = (
    <>
      <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.question}>{f.question}</Text20>
      {/* D2-C: 두 버튼 동등한 양자택일(부모님 노랑·자녀 하늘), 사이 14 */}
      <View style={styles.choices}>
        <RoleChoiceButton tone="parent" title={f.parent} sub={f.parent_sub} onPress={() => onChoose('parent')} />
        <RoleChoiceButton tone="child" title={f.child} sub={f.child_sub} onPress={() => onChoose('child')} />
      </View>
    </>
  );
  const brand = (
    <Animated.View style={[styles.brand, {opacity: brandOpacity, transform: [{translateY: brandRise}]}]}>
      <View testID="brand-symbol-seat" ref={symbolRef} collapsable={false} onLayout={onSymbolLayout} style={fromSplash && !landed ? styles.seatHidden : null}>
        <BrandSymbol size={40} />
      </View>
      <Text20 size={28} weight="bold" style={styles.wordmark}>{f.wordmark}</Text20>
    </Animated.View>
  );

  if (fullScroll) {
    // 아주 큰 글씨: 하단 고정을 풀고 워드마크 → 질문 → 버튼 순서로 한 번에 스크롤
    return (
      <Screen scrollEnabled>
        {brand}
        {ask}
      </Screen>
    );
  }
  return (
    <Screen
      fill
      dockMaxRatio={fontScale >= 1.3 ? 1 : 0.6}
      bottom={
        <View testID="first-dock-content" onLayout={fontScale >= 1.3 ? onDockContent : undefined}>
          {ask}
        </View>
      }>
      {/* 워드마크~소개는 한 덩어리(시안 FS_D: 제목 위 10, 줄 간격 6). 남는 높이는 사진 영역으로 */}
      <View style={styles.head}>
      {brand}
      {showIntro ? (
        <View accessible accessibilityLabel={[f.intro_title, ...f.intro].join('. ')} style={styles.intro}>
          <Text20 size={24} weight="bold">{f.intro_title}</Text20>
          {f.intro.map((t, i) => (
            <Animated.View key={ICONS[i]} style={[styles.item, {opacity: items[i], transform: [{translateX: rise(items[i], -8)}]}]}>
              <Animated.View
                testID={`intro-icon-circle-${i}`}
                style={[
                  styles.circle,
                  {backgroundColor: CIRCLE[i]},
                  {opacity: circles[i], transform: [{scale: still ? 1 : circles[i].interpolate({inputRange: [0, 1], outputRange: [0.6, 1]})}]},
                ]}>
                <Icon name={ICONS[i]} size={24} color={color.inkTitle} />
              </Animated.View>
              {/* 항목은 보통 굵기, 두 줄 허용(셋째 줄의 주어 "자녀가"를 빼지 않는다) */}
              <Text20 style={styles.itemText}>{keepTail(t)}</Text20>
            </Animated.View>
          ))}
        </View>
      ) : null}
      </View>
      <View testID="polaroid-area" style={styles.area} onLayout={onArea}>
        {/* 사진 묶음은 영역 위에 띄워 둔다(영역 크기를 밀어 올리지 않게: 재는 값 = 실제 남은 공간) */}
        <View testID="polaroid-pinned" style={styles.pinned} pointerEvents="none">
          {lay ? <PolaroidStack lay={lay} mode={mode} /> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seatHidden: {opacity: 0},
  head: {gap: 10},
  question: {color: color.ink, marginBottom: 10},
  choices: {gap: 14},
  brand: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4},
  wordmark: {color: color.inkTitle},
  intro: {gap: 6},
  item: {flexDirection: 'row', alignItems: 'center', gap: 10},
  circle: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
  itemText: {flexShrink: 1},
  // 남은 높이를 차지(사진 크기와 무관하게 재어짐). 묶음은 pinned 안 가운데
  area: {flex: 1, minHeight: 0},
  pinned: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center'},
});
