import React from 'react';
import {KeyboardAvoidingView, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {color, layout, space} from './tokens';

type Props = {
  children: React.ReactNode;
  /** 상단 고정(제목·뒤로·한 줄 안내). 스크롤되지 않는다. */
  top?: React.ReactNode;
  /** 하단 고정(주 버튼 1 + 보조 최대 1). 본문과 겹치지 않는 형제라 가려질 수 없다. */
  bottom?: React.ReactNode;
  scrollEnabled?: boolean;
  /** 하단 고정 영역 최대 높이 비율(기본 40%). 첫 화면처럼 버튼이 주인공인 화면만 늘린다. */
  dockMaxRatio?: number;
};

// 표준 화면 틀(design-system/components/README.md §15): TopSafe → Top(고정) → Body(스크롤, flex 1) → Dock(고정).
// 글자를 크게 하면 Body 만 스크롤되고 Dock 은 그대로 화면 안에 남는다. top·bottom 없이 쓰면 예전처럼 한 겹 스크롤.
export function Screen({children, top, bottom, scrollEnabled = true, dockMaxRatio}: Props) {
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const topPad = Math.max(insets.top, space.xl);
  return (
    // Android 도 padding: edgeToEdgeEnabled=true 라 adjustResize 로 창이 줄지 않을 수 있다.
    // (창이 실제로 줄면 KAV 가 겹친 높이를 0으로 계산해 두 번 밀리지 않는다.)
    <KeyboardAvoidingView style={styles.bg} behavior="padding">
      <View style={[styles.top, {paddingTop: topPad}]}>{top}</View>
      <ScrollView
        testID="screen-body"
        style={styles.body}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.bodyPad, bottom ? null : {paddingBottom: space.bottom + insets.bottom}]}>
        {children}
      </ScrollView>
      {bottom ? (
        // 하단 고정 영역은 화면의 40% 이하. 글자를 키워 넘치면 영역 안에서 스크롤(본문을 덮지 않음).
        <View testID="screen-dock" style={[styles.dock, {maxHeight: Math.floor(height * (dockMaxRatio ?? layout.dock.maxHeightRatio))}]}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.dockPad, {paddingBottom: Math.max(layout.dock.paddingBottomMin, insets.bottom)}]}>
            {bottom}
          </ScrollView>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  bg: {flex: 1, backgroundColor: color.paper},
  top: {paddingHorizontal: layout.bodyPadding.x},
  body: {flex: 1, minHeight: 0},
  bodyPad: {
    paddingTop: layout.bodyPadding.top,
    paddingHorizontal: layout.bodyPadding.x,
    paddingBottom: layout.bodyPadding.bottom,
    gap: layout.bodyPadding.gap,
  },
  dock: {
    backgroundColor: color.paper,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
  },
  // 버튼끼리는 BigButton 바깥 여백(위아래 6)으로 12 간격
  dockPad: {paddingTop: layout.dock.paddingTop - 6, paddingHorizontal: layout.dock.x},
});
