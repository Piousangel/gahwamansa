import React, {useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius} from '../../ui/tokens';
import {Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {Icon} from '../../ui/assets/icons';
import type {Message} from '../../copy/copy';
import type {ScreenScroll} from '../../ui/Screen';

// 단계 화면의 하단 고정 영역에 들어가는 오류 패널: 무슨 일인지 + 다음에 할 일 1개(다시 하기 = 주 버튼).
// 흔들지 않고, 색만이 아니라 외곽선·굵은 제목·문구로 알린다. (v3 화면용 — P6 이전 뒤 지운다)
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

// v4(DsScreen) 단계 화면용: 무슨 일인지는 본문 맨 위 위험 띠(흰 면 + dangerInk 테두리 + 경고 아이콘 + 제목·본문 두 줄, 색만으로 알리지 않음),
// 다시 하기는 Dock 주 버튼(stepErrorDock). 흔들지 않는다. 나타날 때 한 번 읽는다(live region).
export function StepErrorBanner({error}: {error: Message}) {
  return (
    <View testID="step-error" accessibilityLiveRegion="polite" style={v4.box}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="icon-warning" size={28} color={ds.color.dangerInk} />
      </View>
      <View style={v4.text}>
        <Text role="bodyLg" tone="danger">{error.title}</Text>
        <Text role="body">{error.body}</Text>
      </View>
    </View>
  );
}
// 보조(읽어 주기 등)는 오류 중에도 그대로 둔다(읽던 소리를 멈출 수 있게, 리뷰)
export const stepErrorDock = (error: Message, onRetry: () => void, secondary?: DockProps['secondary']): DockProps => ({
  primary: {label: error.button, onPress: onRetry},
  secondary,
});

/** 오류가 생기면 본문 맨 위(위험 띠)가 보이게 올린다 — 본문을 내린 채 실패해도 무슨 일인지 보이게(리뷰). DsScreen scrollRef 에 넘긴다 */
export function useErrorTop(error: Message | null) {
  const ref = useRef<ScreenScroll>(null);
  useEffect(() => {
    if (error) {
      ref.current?.showRange(0, 1);
    }
  }, [error]);
  return ref;
}

const v4 = StyleSheet.create({
  box: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, alignSelf: 'stretch', backgroundColor: ds.color.card, borderWidth: 2, borderColor: ds.color.dangerInk, borderRadius: ds.radius.card, paddingVertical: 10, paddingHorizontal: 14},
  text: {flex: 1, gap: 2},
});
