import React from 'react';
import {Pressable, StyleSheet, Text as RNText} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {ds, roleText} from './roles';
import {useAudience} from './audience';

export type BackLinkProps = {
  /** 목적지 문구('오늘 코스로'). 보이는 글 = TalkBack 라벨(SUMMARY 2-5) */
  label: string;
  onPress: () => void;
  /** 자판이 열려 위 영역이 접혔을 때 단계 정보를 읽어 준다(예: '2단계 중 1단계, 이름 쓰기') */
  context?: string;
  testID?: string;
};

const c = ds.color;
const b = ds.backLink;

// 공용 뒤로 링크(Q7). SVG 화살표 + 역할 backLink 글자, 흰 알약 면(card) + line 테두리, 어르신 64×120 이상·자녀 56.
// 글자 배율 때문에 숨기지 않는다(B5). 위치는 왼쪽 위(alignSelf flex-start).
export function BackLink({label, onPress, context, testID = 'back-link'}: BackLinkProps) {
  const a = useAudience();
  const r = roleText('backLink', a, 'action');
  const icon = r.icon ?? b.icon[a];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={context}
      onPress={onPress}
      style={({pressed}) => [
        styles.pill,
        {minHeight: b.height[a], minWidth: a === 'elder' ? b.minWidthElder : undefined},
        pressed ? styles.pressed : null,
      ]}>
      <Svg testID="back-link-arrow" width={icon} height={icon} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        <Path d="M15 5l-7 7 7 7" stroke={c[b.tone]} strokeWidth={b.icon.stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
      <RNText {...koreanTextProps} maxFontSizeMultiplier={r.maxFontSizeMultiplier} style={[r.style, styles.label]}>
        {keepAllChildren(label)}
      </RNText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingLeft: 12, paddingRight: 20, paddingVertical: 6, borderRadius: ds.radius.button,
    backgroundColor: c[b.surface], borderWidth: b.borderWidth, borderColor: c.line,
  },
  pressed: {backgroundColor: c.actionSoft},
  label: {flexShrink: 1},
});
