import React from 'react';
import {useReportTabBar} from '../ui/toastPlacement';
import {Pressable, StyleSheet, View} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text20} from '../ui/Text20';
import {color, FONT_SCALE_MAX, size} from '../ui/tokens';

// 자녀 하단 탭 바(앨범·지난 답): 글자 탭(아이콘만 쓰지 않음), 고른 탭은 굵은 위 선 + 색. 자녀 본문 최소 20, 터치 64.
// 화면 틀이라 글자 확대 1.5배까지. 연결 전(대기 화면)에는 탭 자체가 없다.
export function ChildTabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const onLayout = useReportTabBar(); // 토스트가 막대 실제 높이 위에 뜨게(글자 200%, #199 캡처 L)
  return (
    <View testID="child-tab-bar" accessibilityRole="tablist" onLayout={onLayout} style={[styles.tabs, {paddingBottom: insets.bottom}]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const label = (descriptors[route.key].options.title ?? route.name) as string;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{selected: focused}}
            onPress={() => {
              const e = navigation.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
              if (!focused && !e.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={({pressed}) => [styles.tab, focused ? styles.tabOn : null, pressed ? styles.pressed : null]}>
            <Text20 weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={focused ? styles.on : styles.off}>
              {label}
            </Text20>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {opacity: 0.6},
  tabs: {flexDirection: 'row', backgroundColor: color.card, borderTopWidth: 1, borderTopColor: color.lineSoft},
  tab: {flex: 1, minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center', borderTopWidth: 4, borderTopColor: 'transparent'},
  tabOn: {borderTopColor: color.action},
  on: {color: color.inkTitle},
  off: {color: color.inkSub, fontWeight: 'normal'},
});
