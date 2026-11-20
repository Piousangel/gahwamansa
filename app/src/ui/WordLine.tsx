import React from 'react';
import {StyleSheet, Text as RNText} from 'react-native';
import {keepAllChildren, koreanTextProps} from './koreanText';
import {roleText} from './ds/roles';

// 따라 쓸 낱말 한 줄(P6 시안 ds4b): 입력 칸 글자와 같은 fieldInput 역할(어르신 34, 확대 상한 1.5 — R-11 '입력 글자 상한 1.5 고정').
// 자판이 열려도 200%에서 카드가 잘리지 않게 상한을 역할에서 받는다(화면이 상한을 고르지 않음). 읽기는 감싼 요소가 한 번(여기는 숨김).
export function WordLine({word, testID = 'kb-word'}: {word: string; testID?: string}) {
  const r = roleText('fieldInput', 'elder');
  return (
    <RNText
      {...koreanTextProps}
      testID={testID}
      maxFontSizeMultiplier={r.maxFontSizeMultiplier}
      style={[r.style, styles.center]}
      accessibilityElementsHidden
      importantForAccessibility="no">
      {keepAllChildren(word)}
    </RNText>
  );
}

const styles = StyleSheet.create({center: {textAlign: 'center'}});
