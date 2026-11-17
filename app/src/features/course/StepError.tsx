import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius} from '../../ui/tokens';
import type {Message} from '../../copy/copy';

// 단계 화면의 하단 고정 영역에 들어가는 오류 패널: 무슨 일인지 + 다음에 할 일 1개(다시 하기 = 주 버튼).
// 흔들지 않고, 색만이 아니라 외곽선·굵은 제목·문구로 알린다.
export function StepError({error, onRetry}: {error: Message | null; onRetry: () => void}) {
  if (!error) {
    return null;
  }
  return (
    <>
      <View style={styles.panel} accessibilityLiveRegion="polite">
        <Text20 size={24} weight="bold" style={styles.title}>{error.title}</Text20>
        <Text20>{error.body}</Text20>
      </View>
      <BigButton label={error.button} onPress={onRetry} />
    </>
  );
}
const styles = StyleSheet.create({
  panel: {backgroundColor: color.dangerSoft, borderWidth: 3, borderColor: color.dangerInk, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 16, gap: 4},
  title: {color: color.dangerInk},
});
