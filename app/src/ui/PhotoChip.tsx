import React from 'react';
import {StyleSheet, Text as RNText, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from './koreanText';
import {ds, roleText} from './ds/roles';

// 사진 안 칩(시안 P4_photo_ds4c: 'AI가 만든 그림'). 사진 왼쪽 아래 흰 알약 + line 1.5, 글자 label 20.
// 예외(R-11): 글자 배율과 상관없이 20 고정 — 200%에서 사진(100)을 가리지 않게 시안이 '모든 배율 20'으로 정했다(R-18 최소 20은 지킴).
// 같은 뜻은 사진 읽기 라벨(…, AI가 만든 그림)로도 전하므로 칩은 화면 읽기에서 숨긴다.
export function PhotoChip({label, testID = 'photo-ai-chip'}: {label: string; testID?: string}) {
  const r = roleText('label', 'elder');
  return (
    <View testID={testID} style={styles.chip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <RNText {...koreanTextProps} allowFontScaling={false} style={r.style}>
        {keepAllChildren(label)}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute', left: 10, bottom: 10, maxWidth: '90%',
    backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1.5, borderColor: ds.color.line,
    borderRadius: 999, paddingHorizontal: 10,
  },
});
