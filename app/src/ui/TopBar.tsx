import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text20} from './Text20';
import {SettingsLink} from './ds/SettingsLink';
import {FONT_SCALE_MAX, size} from './tokens';

// 탭 루트·대기 화면 상단 바: 왼쪽 제목(없으면 빈 칸), 오른쪽 설정(ds SettingsLink — 어르신 코스 홈과 같은 컴포넌트, P-3). '‹ 이전' 없음(DECISIONS 264행).
// 문구는 props 로 받는다(ui 는 copy 를 모른다). 글자 확대 상한: 제목 1.5배(FONT_SCALE_MAX, 화면 틀), 설정은 ds link 역할 2배(SettingsLink — 어르신과 같은 컴포넌트).
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
        <SettingsLink label={settingsLabel} onPress={onSettings} testID="topbar-settings" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'center', minHeight: size.touchMin, gap: 8},
  flex: {flex: 1},
});
