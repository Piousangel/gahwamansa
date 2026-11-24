import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ds} from './ds/roles';

type PressNode = React.ComponentRef<typeof View>;

/**
 * 사진 틀 겸 '크게 보기' 누름 영역(D-3 '오늘 한 장'). 둘레 카드·그림자 없이 반경만(v5 '장식 폐기', 시안 d3-course-review).
 * 크기(원본 비율 틀)는 호출부가 photoFrame 으로 계산해 준다. 문구는 모른다 — 읽기 이름·힌트는 props.
 * 누를 수 없을 때(불러오기 전·실패·준비 중)는 읽기 대상에서도 빠진다(안의 사진·안내가 따로 읽힌다).
 */
export function PhotoButton({
  frame,
  canPress,
  label,
  hint,
  onPress,
  pressRef,
  testID = 'photo-polaroid',
  children,
}: {
  frame: {width: number; height: number};
  canPress: boolean;
  label?: string;
  hint?: string;
  onPress: () => void;
  pressRef?: React.Ref<PressNode>;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      ref={pressRef}
      testID={testID}
      disabled={!canPress}
      accessible={canPress}
      accessibilityRole={canPress ? 'button' : undefined}
      accessibilityLabel={canPress ? label : undefined}
      accessibilityHint={canPress ? hint : undefined}
      onPress={onPress}
      style={[styles.photo, frame]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: {alignSelf: 'center', borderRadius: ds.radius.row, overflow: 'hidden', backgroundColor: ds.color.paperSoft},
});
