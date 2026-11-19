import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {color, FONT_SCALE_MAX} from '../../ui/tokens';
import {keepAllChildren, koreanTextProps} from '../../ui/koreanText';
import {Icon} from '../../ui/assets/icons';

// 첫 화면 역할 선택 버튼 전용(D2-C, DECISIONS 11-17). 토큰 규칙("단단한 하단 그림자 폐기"·"눌림은 움직임 없음")의
// 예외는 이 버튼에만 쓴다: 앱의 첫 탭이라 '누르는 것' 신호가 가장 필요해서. 다른 화면에서 쓰지 않는다.
// 부모님=노랑 면, 자녀=하늘 면, 갈색 테두리 3 + 아래 두께 7, 오른쪽 ›. 누르면 두께 3·4 내려감·면 actionSoft, 손 떼면 바로 이동.
type Props = {tone: 'parent' | 'child'; title: string; sub: string; onPress: () => void};

export function RoleChoiceButton({tone, title, sub, onPress}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({pressed}) => roleChoiceStyle(tone, pressed)}>
      <View style={styles.row}>
        <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.title}>
          {keepAllChildren(title)}
        </Text>
        <Icon name="icon-chevron-right" size={26} color={color.ink} />
      </View>
      <Text {...koreanTextProps} maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.sub}>
        {keepAllChildren(sub)}
      </Text>
    </Pressable>
  );
}

// 눌림 여부에 따른 버튼 모양(테스트에서 직접 확인)
export const roleChoiceStyle = (tone: Props['tone'], pressed: boolean) => [
  styles.base,
  {backgroundColor: pressed ? color.actionSoft : tone === 'parent' ? color.accentSun : color.sky},
  pressed ? styles.pressed : null,
];

const styles = StyleSheet.create({
  base: {
    minHeight: 88,
    borderRadius: 24,
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: color.ink,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 12,
    justifyContent: 'center',
  },
  // 눌림: 바닥 두께가 꺼지고(7→3) 4 내려간다 — 전체 높이는 그대로
  pressed: {borderBottomWidth: 3, transform: [{translateY: 4}]},
  row: {flexDirection: 'row', alignItems: 'center', gap: 6},
  title: {flex: 1, minWidth: 0, fontSize: 26, lineHeight: 33, fontWeight: 'bold', color: color.inkTitle},
  sub: {fontSize: 20, lineHeight: 27, marginTop: 2, color: color.inkBody},
});
