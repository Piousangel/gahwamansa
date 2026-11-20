import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, type IconName} from '../assets/icons';
import {announce} from '../a11y';
import {Button} from './Button';
import {Text} from './Text';
import {ds} from './roles';
import type {ColorV4} from '../tokensV4';

export type BannerTone = 'info' | 'done' | 'danger' | 'offline' | 'notice';

/**
 * 띠의 면·글자·아이콘 색 이름. 글자는 모든 면에서 허용되는 inkBody, 뜻은 아이콘·테두리(색만으로 구분하지 않음).
 * 조합은 tokens-v4 허용 목록 안이어야 한다(dsComponents.test 가 검사): info 는 infoSoft 띠 + info 아이콘(정보 = 면 + 아이콘).
 */
export const BANNER_LOOK: Record<BannerTone, {surface: ColorV4; text: ColorV4; icon: ColorV4; border: ColorV4; iconName: IconName}> = {
  info: {surface: 'infoSoft', text: 'inkBody', icon: 'info', border: 'info', iconName: 'icon-info'},
  done: {surface: 'card', text: 'inkBody', icon: 'doneInk', border: 'doneInk', iconName: 'icon-check'},
  danger: {surface: 'card', text: 'inkBody', icon: 'dangerInk', border: 'dangerInk', iconName: 'icon-warning'},
  offline: {surface: 'paperSoft', text: 'inkBody', icon: 'info', border: 'line', iconName: 'icon-wifi-off'},
  // 상태 안내(내가 잘못한 게 아님): noticeSoft 면 + ⓘ + inkBody. 예: N1 휴대폰 설정에서 알림이 꺼져 있음(#168 디자인)
  notice: {surface: 'noticeSoft', text: 'inkBody', icon: 'info', border: 'info', iconName: 'icon-info'},
};

/**
 * 띠 안 행동(PR #29 리뷰 M2): 옅은 면(infoSoft·paperSoft) 위 action 글자는 어르신 7:1 미달(6.63·6.47)이라
 * 글자 링크가 아니라 흰 알약(보조 버튼: card 면 + action 테두리·글자 7.80)으로 둔다. 짝은 dsComponents.test 가 허용 목록으로 검사.
 */
export const BANNER_ACTION = {kind: 'secondary', text: 'action', surface: 'card'} as const;

const c = ds.color;

// 같은 자리 띠(SUMMARY 2-7): 이미 받은 내용이 있으면 화면을 바꾸지 않고 띠만 띄운다. 나타날 때·문구가 바뀔 때 한 번 읽는다(R11).
// 기존 ui/Banner·Toast 는 그대로 둔다(화면 이행은 시안 v4 뒤). 이 판은 글자 역할 규칙(자녀 포함)을 따른다.
export function Banner({tone, text, action, testID = 'ds-banner'}: {tone: BannerTone; text: string; action?: {label: string; onPress: () => void}; testID?: string}) {
  const look = BANNER_LOOK[tone];
  useEffect(() => {
    announce(text);
  }, [tone, text]);
  return (
    <View testID={testID} style={[styles.box, {backgroundColor: c[look.surface], borderColor: c[look.border]}]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={look.iconName} size={28} color={c[look.icon]} />
      </View>
      <View style={styles.text}>
        <Text role="body">{text}</Text>
      </View>
      {action ? <Button kind={BANNER_ACTION.kind} size="inline" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, alignSelf: 'stretch',
    borderWidth: 2, borderRadius: ds.radius.card, paddingVertical: 10, paddingHorizontal: 14,
  },
  text: {flexGrow: 1, flexShrink: 1, flexBasis: 160},
});
