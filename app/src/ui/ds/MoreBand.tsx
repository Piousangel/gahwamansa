import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {ds} from './roles';

/** '더 있음' 띠 높이(R-19). 글자를 담지 않는 장식 띠라 고정 높이 예외 */
export const MORE_BAND_H = 24;

// R-19: 흐림(페이드)을 글자 위에 겹치지 않는다. 스크롤 영역 밖 아래에 24 높이 띠 + 아래 화살표.
// 장식이라 화면 읽기에서 숨긴다(TalkBack 은 스크롤로 다음 내용을 읽는다).
export function MoreBand() {
  return (
    <View testID="more-band" style={styles.band} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M6 9l6 6 6-6" stroke={ds.color.action} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {height: MORE_BAND_H, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.color.paperSoft, borderTopWidth: 1, borderTopColor: ds.color.line},
});
