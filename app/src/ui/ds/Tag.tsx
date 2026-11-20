import React from 'react';
import {StyleSheet, Text as RNText, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {useAudience} from './audience';
import {ds, fontStyle, roleText} from './roles';

export type TagProps = {
  /** 보이는 글(예: '지금 할 차례'). 색이 아니라 글자로 뜻을 전한다 */
  label: string;
  testID?: string;
};

const c = ds.color;

/** 꼬리표 모양(RULES-V4 v5: Tag(accent) = 먹 면 + 흰 글자 + 글자, 반경 6). 테스트가 대비(어르신 7:1)를 계산한다 */
export const TAG_LOOK = {bg: c.accent, ink: c.onAction, radius: ds.radius.row} as const;

/**
 * Tag(v5 accent): '지금 할 차례' 같은 상태 꼬리표. 누를 수 없다 — 파랑·밑줄 없음(R-08), 노랑 없음(R-22), 그림자 없음.
 * 글자는 label 역할 크기(어르신 20·자녀 16)에 굵게 700. 좁으면 줄바꿈(말줄임 없음), 꼬리표는 부모 폭을 넘지 않는다.
 * 읽기: 따로 초점을 받지 않는다 — 행(부모)이 '{제목}, {상태}' 로 읽는다.
 */
export function Tag({label, testID}: TagProps) {
  const a = useAudience();
  const r = roleText('label', a);
  return (
    <View testID={testID} style={styles.tag}>
      <RNText {...koreanTextProps} maxFontSizeMultiplier={r.maxFontSizeMultiplier} style={[r.style, fontStyle('body', 700), styles.text]}>
        {keepAllChildren(label)}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: TAG_LOOK.bg, borderRadius: TAG_LOOK.radius, paddingHorizontal: 10, paddingVertical: 2},
  text: {color: TAG_LOOK.ink, fontWeight: '700', flexShrink: 1},
});
