import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ds, minTouch} from './roles';

/**
 * 목록 행(list 틀, 시안 P3_P4_P5_ds4b 단계 행). 면·테두리는 tone 으로만:
 * - now: actionSoft 면 + action 테두리 3(누르는 행, '지금 할 차례')
 * - done: 흰 면 + line 테두리 1.5(누르면 다시 보기)
 * - wait: 흰 면 + line 테두리 1.5(누르지 않음)
 * onPress 가 있으면 행 전체가 버튼(R-06: 면 + 오른쪽 › 를 호출부가 함께 둔다). 읽기 이름은 보이는 글과 같게 호출부가 준다(R-14).
 * 높이는 minHeight 만(R-09, 어르신 64).
 */
export type ListRowTone = 'now' | 'done' | 'wait';

export function ListRow({
  tone,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  testID,
  pressRef,
}: {
  tone: ListRowTone;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: React.ReactNode;
  testID?: string;
  pressRef?: React.Ref<React.ComponentRef<typeof Pressable>>;
}) {
  const style = [styles.row, tone === 'now' ? styles.now : styles.plain];
  if (onPress) {
    return (
      <Pressable
        ref={pressRef}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({pressed}) => [...style, pressed ? (tone === 'now' ? styles.nowPressed : styles.pressed) : null]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} accessible accessibilityLabel={accessibilityLabel} style={style}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {minHeight: minTouch('secondary', 'elder'), borderRadius: ds.radius.card, paddingVertical: 14, paddingHorizontal: 18, justifyContent: 'center'},
  now: {backgroundColor: ds.color.actionSoft, borderWidth: 3, borderColor: ds.color.action, gap: 6},
  plain: {backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, gap: 2},
  pressed: {backgroundColor: ds.color.paperSoft},
  nowPressed: {backgroundColor: ds.color.noticeSoft},
});
