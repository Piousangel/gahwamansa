import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text20} from './Text20';
import {Icon} from './assets/icons';
import {color, FONT_SCALE_MAX, size} from './tokens';

// 탭 루트·대기 화면 상단 바: 왼쪽 제목(없으면 빈 칸), 오른쪽 설정(아이콘 + 글자). '‹ 이전' 없음(DECISIONS 264행).
// 문구는 props 로 받는다(ui 는 copy 를 모른다). 화면 틀이라 글자 확대 1.5배까지.
type Props = {title?: string; settingsLabel?: string; onSettings?: () => void};

export function TopBar({title, settingsLabel, onSettings}: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.flex}>
        {title ? (
          <Text20 size={24} weight="bold" accessibilityRole="header" maxFontSizeMultiplier={FONT_SCALE_MAX}>
            {title}
          </Text20>
        ) : null}
      </View>
      {onSettings && settingsLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={settingsLabel}
          onPress={onSettings}
          hitSlop={8}
          style={({pressed}) => [styles.settings, pressed ? styles.pressed : null]}>
          <Icon name="icon-settings" size={28} color={color.ink} />
          <Text20 weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.action}>{settingsLabel}</Text20>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'center', minHeight: size.touchMin, gap: 8},
  flex: {flex: 1},
  settings: {flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: size.touchMin, paddingLeft: 8},
  pressed: {opacity: 0.6},
  // 누르는 글자는 갈색(아이콘과 같은 색) — Text20 기본 inkBody 를 따라가지 않게(#140 리뷰 M1)
  action: {color: color.ink},
});
