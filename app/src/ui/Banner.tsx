import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {color, radius, shadow, touch} from './tokens';
import {Text20} from './Text20';
import {Icon, IconName} from './assets/icons';
import {announce} from './a11y';
import {fadeMs, useReduceMotion} from './motion';

export type BannerKind = 'error' | 'offline' | 'success' | 'info';
type Props = {
  kind: BannerKind;
  /** 한 줄 20자 안팎. 코드명(rate_limited 등) 금지, 누구 잘못도 아닌 말투 + 다음에 할 일 하나 */
  text: string;
  action?: {label: string; onPress: () => void};
  /** 성공 배너가 사라진 뒤 */
  onHidden?: () => void;
  testID?: string;
};

/** 성공 배너 유지 시간(README §13: 6초 이상). 나머지 종류는 자동으로 사라지지 않는다(어르신은 읽는 속도가 느림). */
export const BANNER_SUCCESS_MS = 6000;

const LOOK: Record<BannerKind, {bg: string; border: string; ink: string; icon: IconName}> = {
  error: {bg: color.dangerSoft, border: color.danger, ink: color.dangerInk, icon: 'icon-warning'},
  offline: {bg: color.noticeSoft, border: color.ink, ink: color.inkTitle, icon: 'icon-wifi-off'},
  success: {bg: color.doneSoft, border: color.done, ink: color.doneInk, icon: 'icon-check'},
  info: {bg: color.noticeSoft, border: color.line, ink: color.inkTitle, icon: 'icon-info'},
};

/**
 * 어르신 배너(README §13). 짧게 사라지는 토스트를 어르신에게 쓰지 않는다 → 이것을 쓴다.
 * 오프라인 → 인터넷이 돌아오면 같은 자리에서 kind="success" 로 바꾸면 그때부터 6초 뒤 사라진다.
 * 접근성(TalkBack R11): 나타날 때·문구가 바뀔 때 한 번만 읽는다(오류도 polite). 아이콘은 장식(R5).
 */
export function Banner({kind, text, action, onHidden, testID}: Props) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const [hidden, setHidden] = useState(false);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;
  const look = LOOK[kind];

  // R11: 같은 (종류, 문구)는 한 번만 읽는다
  useEffect(() => {
    announce(text);
  }, [kind, text]);

  useEffect(() => {
    setHidden(false);
    opacity.setValue(1);
    if (kind !== 'success') {
      return;
    }
    const ms = fadeMs(reduce);
    let done: ReturnType<typeof setTimeout> | undefined;
    const stay = setTimeout(() => {
      if (ms > 0) {
        Animated.timing(opacity, {toValue: 0, duration: ms, useNativeDriver: true}).start();
      }
      done = setTimeout(() => {
        setHidden(true);
        onHiddenRef.current?.();
      }, ms);
    }, BANNER_SUCCESS_MS);
    return () => {
      clearTimeout(stay);
      if (done) clearTimeout(done);
    };
    // reduce 가 늦게 확인돼도 타이머를 다시 시작하지 않는다(머무는 시간이 늘어나지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, text, opacity]);

  if (hidden) {
    return null;
  }
  return (
    <Animated.View
      testID={testID ?? 'banner'}
      style={[styles.box, {backgroundColor: look.bg, borderColor: look.border, opacity}]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={look.icon} size={32} color={look.ink} />
      </View>
      <Text20 size={22} weight="bold" style={[styles.text, {color: look.ink}]}>
        {text}
      </Text20>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({pressed}) => [styles.action, pressed ? styles.actionPressed : null]}>
          <Text20 size={22} weight="bold" style={[styles.actionText, {color: look.ink}]}>
            {action.label}
          </Text20>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch.elderMin, borderWidth: 3,
    borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14, boxShadow: shadow.soft,
  },
  text: {flex: 1},
  action: {minHeight: touch.link, minWidth: touch.link, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderRadius: radius.chip},
  actionPressed: {backgroundColor: 'rgba(116,72,33,0.10)'},
  actionText: {textDecorationLine: 'underline'},
});
