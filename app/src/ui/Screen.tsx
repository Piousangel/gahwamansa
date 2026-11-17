import React, {useCallback, useEffect, useRef, useState} from 'react';
import {KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {color, layout, space} from './tokens';
import {focusLater, ScreenTitleContext} from './screenTitle';

const FADE_H = 28; // §15: 본문이 넘치면 아래 28 높이 페이드로 "더 있음"

type Props = {
  children: React.ReactNode;
  /** 상단 고정(제목·뒤로·한 줄 안내). 스크롤되지 않는다. */
  top?: React.ReactNode;
  /** 하단 고정(주 버튼 1 + 보조 최대 1). 본문과 겹치지 않는 형제라 가려질 수 없다. */
  bottom?: React.ReactNode;
  scrollEnabled?: boolean;
  /** 하단 고정 영역 최대 높이 비율(기본 40%). 첫 화면처럼 버튼이 주인공인 화면만 늘린다. */
  dockMaxRatio?: number;
  /** 본문이 남은 높이를 꽉 채운다(스크롤 없는 한 화면 구성, 예: 첫 화면). */
  fill?: boolean;
};

// 표준 화면 틀(design-system/components/README.md §15): TopSafe → Top(고정) → Body(스크롤, flex 1) → Dock(고정).
// 글자를 크게 하면 Body 만 스크롤되고 Dock 은 그대로 화면 안에 남는다. top·bottom 없이 쓰면 예전처럼 한 겹 스크롤.
export function Screen({children, top, bottom, scrollEnabled = true, dockMaxRatio, fill}: Props) {
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  // TopSafe 52 이상(§15). 상태바 바로 아래에 붙지 않게 상태바 높이 + 12(QA B6)
  const topPad = Math.max(space.topSafeMin, insets.top + space.md);

  // 본문이 넘치고 아직 끝까지 내리지 않았으면 아래 페이드(QA B4: 가려진 내용이 있다는 표시)
  const [box, setBox] = useState({view: 0, content: 0, y: 0});
  const more = box.view > 0 && box.content - box.view - box.y > 4;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
    setBox({view: layoutMeasurement.height, content: contentSize.height, y: contentOffset.y});
  };

  // 화면 제목(먼저 알린 머리글: 위 고정 영역 → 본문 순서)에 접근성 포커스. 화면당 한 번(마운트 때)
  const title = useRef<unknown>(null);
  const register = useCallback((node: unknown) => {
    if (!title.current) {
      title.current = node;
    }
  }, []);
  useEffect(() => focusLater(() => title.current), []);

  // KAV: Android 도 padding. edgeToEdgeEnabled=true 라 adjustResize 로 창이 줄지 않을 수 있다.
  // (창이 실제로 줄면 KAV 가 겹친 높이를 0으로 계산해 두 번 밀리지 않는다.)
  return (
    <ScreenTitleContext.Provider value={register}>
      <KeyboardAvoidingView style={styles.bg} behavior="padding">
        <View testID="screen-top" style={[styles.top, {paddingTop: topPad}]}>{top}</View>
        <View style={styles.body}>
          <ScrollView
            testID="screen-body"
            style={styles.body}
            scrollEnabled={fill ? false : scrollEnabled}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={64}
            onScroll={onScroll}
            onLayout={e => {
              const h = e.nativeEvent.layout.height;
              setBox(b => (b.view === h ? b : {...b, view: h}));
            }}
            onContentSizeChange={(_w, h) => setBox(b => (b.content === h ? b : {...b, content: h}))}
            contentContainerStyle={[styles.bodyPad, fill ? styles.fill : null, bottom ? null : {paddingBottom: space.bottom + insets.bottom}]}>
            {children}
          </ScrollView>
          {more && !fill ? (
            <View testID="screen-more" pointerEvents="none" style={styles.more} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Svg width="100%" height={FADE_H}>
                <Defs>
                  <LinearGradient id="screenMore" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color.paper} stopOpacity={0} />
                    <Stop offset="1" stopColor={color.paper} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height={FADE_H} fill="url(#screenMore)" />
              </Svg>
            </View>
          ) : null}
        </View>
        {bottom ? (
          // 하단 고정 영역은 화면의 40% 이하. 글자를 키워 넘치면 영역 안에서 스크롤(본문을 덮지 않음).
          <View testID="screen-dock" style={[styles.dock, {maxHeight: Math.floor(height * (dockMaxRatio ?? layout.dock.maxHeightRatio))}]}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.dockPad, {paddingBottom: Math.max(layout.dock.paddingBottomMin, 16 + insets.bottom)}]}>
              {bottom}
            </ScrollView>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenTitleContext.Provider>
  );
}
const styles = StyleSheet.create({
  bg: {flex: 1, backgroundColor: color.paper},
  top: {paddingHorizontal: layout.bodyPadding.x},
  body: {flex: 1, minHeight: 0},
  more: {position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_H},
  fill: {flexGrow: 1, paddingBottom: 8}, // 한 화면 구성은 아래 여백을 줄여 본문 공간을 확보
  bodyPad: {
    paddingTop: layout.bodyPadding.top,
    paddingHorizontal: layout.bodyPadding.x,
    paddingBottom: layout.bodyPadding.bottom,
    gap: layout.bodyPadding.gap,
  },
  dock: {
    backgroundColor: color.paper,
  },
  // 버튼끼리는 BigButton 바깥 여백(위아래 6)으로 12 간격
  dockPad: {paddingTop: layout.dock.paddingTop - 6, paddingHorizontal: layout.dock.x},
});
