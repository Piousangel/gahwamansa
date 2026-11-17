import React, {useRef, type RefObject} from 'react';
import {Animated, Modal, ScrollView, StyleSheet, View} from 'react-native';
import {color, font, radius} from './tokens';
import {Text20} from './Text20';
import {BigButton} from './BigButton';
import {Icon} from './assets/icons';
import {focusOn, useReturnFocus} from './a11y';
import {useFadeIn} from './useFadeIn';

export type DialogAction = {
  label: string;
  onPress: () => void;
  /** 맨 위(첫 번째)가 안전한 주 버튼. 기본: 첫 번째 primary, 나머지 secondary. */
  kind?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  /** TalkBack R8: 비활성이면 이유를 버튼 위 글자 + 힌트로 */
  disabled?: boolean;
  disabledReason?: string;
};

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  /** 1~3개, 세로로 쌓는다. 선택지가 곧 닫는 길(X 없음, 밖 눌러도 안 닫힘). */
  actions: DialogAction[];
  /** danger: "조심하세요" 칩 + 경고 아이콘(색만으로 구분하지 않음) */
  tone?: 'normal' | 'danger';
  /** 안드로이드 뒤로. 없으면 맨 위(안전한) 선택지를 누른 것과 같다. */
  onBack?: () => void;
  /** TalkBack R12: 닫히면 포커스를 돌려줄 요소(이 대화상자를 연 버튼) */
  returnFocusRef?: RefObject<unknown>;
  testID?: string;
};

/**
 * 어르신 대화상자(README §12): 지금 하던 일을 멈추고 꼭 답할 때만, 하루 한 번 이하. 단순 안내는 Banner, 오류는 오류 패널.
 * 접근성: alertdialog + accessibilityViewIsModal(iOS), Android 는 Modal 이 별도 창이라 TalkBack 포커스가 안에 갇힌다.
 * 열리면 포커스가 제목으로, 닫히면 연 버튼으로(TalkBack R12). 열기 모션은 불투명도만 300ms(동작 줄이기면 바로).
 */
export function Dialog({visible, title, body, actions, tone = 'normal', onBack, returnFocusRef, testID}: Props) {
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  useReturnFocus(visible, returnFocusRef);
  const {opacity, start} = useFadeIn();
  const danger = tone === 'danger';

  const onShow = () => {
    start();
    focusOn(titleRef);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={onShow}
      onRequestClose={() => (onBack ?? actions[0]?.onPress)?.()}>
      {/* 어두운 배경: 누를 곳 없음(실수로 닫히지 않게) */}
      <Animated.View testID="dialog-scrim" style={[styles.scrim, {opacity}]}>
        <View testID={testID ?? 'dialog-card'} role="alertdialog" accessibilityViewIsModal style={styles.card}>
          {danger ? (
            <View style={styles.chip}>
              <Icon name="icon-warning" size={24} color={color.onAction} />
              <Text20 weight="bold" style={styles.chipText}>
                조심하세요
              </Text20>
            </View>
          ) : null}
          <View ref={titleRef} accessible accessibilityRole="header">
            <Text20 size={32} weight="bold" style={styles.title}>
              {title}
            </Text20>
          </View>
          {body ? (
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
              <Text20 size={22}>{body}</Text20>
            </ScrollView>
          ) : null}
          <View testID="dialog-actions" style={styles.actions}>
            {actions.map((a, i) => (
              <BigButton
                key={a.label}
                label={a.label}
                onPress={a.onPress}
                loading={a.loading}
                disabled={a.disabled}
                disabledReason={a.disabledReason}
                variant={a.kind ?? (i === 0 ? 'primary' : 'secondary')}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {flex: 1, backgroundColor: 'rgba(78,47,20,0.58)', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32},
  card: {backgroundColor: color.card, borderRadius: radius.sheet, paddingHorizontal: 20, paddingVertical: 24, gap: 12, maxHeight: '100%'},
  chip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    backgroundColor: color.dangerInk, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 4,
  },
  chipText: {color: color.onAction},
  title: {color: color.inkTitle, fontFamily: font.title},
  // 150%에서 화면을 넘으면 본문만 스크롤, 버튼은 아래에 남는다
  bodyScroll: {flexGrow: 0, flexShrink: 1},
  bodyContent: {paddingBottom: 4},
  actions: {marginTop: 4},
});
