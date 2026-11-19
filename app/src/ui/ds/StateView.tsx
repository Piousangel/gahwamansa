import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, type IconName} from '../assets/icons';
import {announce} from '../a11y';
import {Button} from './Button';
import {Text} from './Text';
import {ds} from './roles';

export type StateKind = 'loading' | 'empty' | 'error' | 'offline';
export type StateViewProps = {
  kind: StateKind;
  title: string;
  body?: string;
  /** 할 일 1개(SUMMARY 2-7) */
  action?: {label: string; onPress: () => void};
  testID?: string;
};

const ICON: Record<StateKind, {name: IconName; color: 'info' | 'dangerInk' | 'action'} | null> = {
  loading: null, // 어르신: 회전 스피너 금지(motion.elderForbidden) → 글자 한 줄 + busy
  empty: {name: 'icon-info', color: 'info'},
  error: {name: 'icon-warning', color: 'dangerInk'},
  offline: {name: 'icon-wifi-off', color: 'info'},
};

// 전면 상태(빈·로딩·오류·오프라인). 오프라인·오류는 아이콘 + 문구(색만으로 알리지 않음), 나타날 때 한 번 읽어 준다.
// 문구는 호출부(copy)가 넘긴다. 칭찬·평가·부재 압박 문구 금지는 copy 규칙(ease-and-joy C절).
export function StateView({kind, title, body, action, testID = 'state-view'}: StateViewProps) {
  const icon = ICON[kind];
  useEffect(() => {
    if (kind === 'offline' || kind === 'error') {
      announce(body ? `${title} ${body}` : title);
    }
  }, [kind, title, body]);
  return (
    <View testID={testID} style={styles.wrap} accessibilityState={{busy: kind === 'loading'}} accessibilityLiveRegion="none">
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name={icon.name} size={40} color={ds.color[icon.color]} />
        </View>
      ) : null}
      {/* 불러오는 중은 머리글이 아니다(PR #98 리뷰 L1: '잠시만요'가 제목처럼 읽혔음) — 빈·오류·오프라인만 머리글 */}
      <Text role="heading" accessibilityRole={kind === 'loading' ? undefined : 'header'} style={styles.center}>
        {title}
      </Text>
      {body ? (
        <Text role="body" style={styles.center}>
          {body}
        </Text>
      ) : null}
      {action ? <Button kind={kind === 'loading' ? 'secondary' : 'primary'} label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', gap: ds.space.between.elder, paddingVertical: ds.space.section, alignSelf: 'stretch'},
  center: {textAlign: 'center'},
});
