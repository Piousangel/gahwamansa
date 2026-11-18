import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text20} from './Text20';
import {Icon} from './assets/icons';
import {color, radius, size} from './tokens';

type Props = {
  title: string;
  /** 이름 아래 보조 글(상태·설명). 읽기는 이름과 함께 */
  sub?: string;
  onPress?: () => void;
  /** 위험 행(모두 지우기): 위험 색 글자, 맨 아래에만 둔다 */
  danger?: boolean;
  /** 읽기 라벨을 바꿀 때(기본: 이름, 보조 글은 힌트) */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  /** 오른쪽 끝(토글 등). 없고 onPress 가 있으면 '›' */
  right?: React.ReactNode;
  /** 다른 화면으로 가지 않는 행(같은 화면에서 확인을 여닫음)은 '›'를 끈다 */
  noChevron?: boolean;
  /** 보조 글 앞 위험 색 표시(예: 개발·staging '[설정 필요]', 디자인 판정 M8 "빨간"). 읽기는 보조 글과 함께 */
  badge?: string;
  /** 펼침·진행 중 상태(사업자 정보 펼침 expanded, 약관 확인 중 busy — l2-appinfo 리뷰 L2·L3) */
  accessibilityState?: {expanded?: boolean; busy?: boolean};
};

// 어르신 설정 행(시안 P13_more v2, UX U8): 이름 + 보조 글, 오른쪽 '›'. 행 전체가 터치(64 이상).
// 누르는 행은 버튼, 누르지 않는 행(앱 정보 등)은 한 덩어리 글. 문구는 호출부가 copy 에서 넘긴다(ui 는 copy 를 모름).
export function SettingsRow({title, sub, onPress, danger, accessibilityLabel, accessibilityHint, testID, right, noChevron, badge, accessibilityState}: Props) {
  const subText = [badge, sub].filter(Boolean).join(' ');
  const content = (
    <>
      <View style={styles.text}>
        <Text20 size={24} weight="bold" style={danger ? styles.danger : styles.title}>{title}</Text20>
        {badge || sub ? (
          <Text20 style={styles.sub}>
            {badge ? <Text20 style={styles.danger}>{sub ? `${badge} ` : badge}</Text20> : null}
            {sub}
          </Text20>
        ) : null}
      </View>
      {right ?? (onPress && !noChevron ? <Icon name="icon-chevron-right" size={24} color={danger ? color.dangerInk : color.ink} /> : null)}
    </>
  );
  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel ?? (subText ? `${title}, ${subText}` : title)}
        accessibilityState={accessibilityState}
        style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint ?? (subText || undefined)}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
      {content}
    </Pressable>
  );
}

/** 구역 제목(가족·알림과 소리·앱). 화면 읽기에서 머리글 */
export function SettingsGroup({title}: {title: string}) {
  return (
    <Text20 weight="bold" accessibilityRole="header" style={styles.group}>
      {title}
    </Text20>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.touchMin,
    backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16,
  },
  pressed: {backgroundColor: color.actionSoft},
  text: {flex: 1, gap: 2},
  title: {color: color.inkTitle},
  danger: {color: color.dangerInk},
  sub: {color: color.inkSub},
  group: {color: color.inkSub, marginTop: 8},
});
