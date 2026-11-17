import React, {useEffect, useRef, type RefObject} from 'react';
import {Animated, Modal, ScrollView, StyleSheet, View} from 'react-native';
import {color, font, radius} from './tokens';
import {Text20} from './Text20';
import {BigButton} from './BigButton';
import {Icon} from './assets/icons';
import {useModalFocus} from './a11y';
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
  /** 되돌릴 수 없는 행동(P9 2단계·C8 지우기)일 때만 준다: 경고 칩 글자(예: "조심하세요") + 경고 아이콘.
   *  로그아웃·그만 보여 주기 같은 확인에는 주지 않는다(impl-drift #6). 위험 버튼 자체는 actions 의 kind:'danger'.
   *  ui/ 는 문구를 모르므로 글자는 호출부가 copy 에서 넘긴다(ARCHITECTURE §2). */
  warningLabel?: string;
  /** 안드로이드 뒤로. 없으면 맨 위(안전한) 선택지를 누른 것과 같다(그 선택지가 비활성·로딩이면 무시). */
  onBack?: () => void;
  /** TalkBack R12: 닫히면 포커스를 돌려줄 요소(이 대화상자를 연 버튼) */
  returnFocusRef?: RefObject<unknown>;
  /** 모달 안 오류 한 줄(리뷰 M2: 모달 위 토스트는 Modal 창 밑에 그려져 안 보인다). 버튼 바로 위, 화면 읽기 polite */
  error?: string | null;
  testID?: string;
};

/**
 * 어르신 대화상자(README §12): 지금 하던 일을 멈추고 꼭 답할 때만, 하루 한 번 이하. 단순 안내는 Banner, 오류는 오류 패널.
 * 접근성: alertdialog + accessibilityViewIsModal(iOS), Android 는 Modal 이 별도 창이라 TalkBack 포커스가 안에 갇힌다.
 * 열리면 300ms 뒤 포커스가 제목으로, 닫히면 연 버튼으로(TalkBack R2·R12). 열기 모션은 불투명도만 300ms(동작 줄이기면 바로).
 */
export function Dialog({visible, title, body, actions, warningLabel, onBack, returnFocusRef, error, testID}: Props) {
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  const openFocus = useModalFocus(visible, titleRef, returnFocusRef);
  const {opacity, start} = useFadeIn(visible);

  // 리뷰 M1: 이중 요청 방지. 한 번 실행하면 호출부가 다시 그려 줄 때(로딩 표시·오류 등 actions 새로 받음)까지 무시
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [actions, visible]);
  const fire = (a: DialogAction | undefined) => {
    if (!a || a.disabled || a.loading || fired.current) {
      return;
    }
    fired.current = true;
    a.onPress();
  };

  const onShow = () => {
    start();
    openFocus();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={onShow}
      onRequestClose={() => (onBack ? onBack() : fire(actions[0]))}>
      {/* 어두운 배경: 누를 곳 없음(실수로 닫히지 않게) */}
      <Animated.View testID="dialog-scrim" style={[styles.scrim, {opacity}]}>
        <View testID={testID ?? 'dialog-card'} role="alertdialog" accessibilityViewIsModal style={styles.card}>
          {warningLabel ? (
            <View style={styles.chip}>
              <Icon name="icon-warning" size={24} color={color.onAction} />
              <Text20 weight="bold" style={styles.chipText}>
                {warningLabel}
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
          {error ? (
            <Text20 testID="dialog-error" weight="bold" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text20>
          ) : null}
          <View testID="dialog-actions" style={styles.actions}>
            {actions.map((a, i) => (
              <BigButton
                key={a.label}
                label={a.label}
                onPress={() => fire(a)}
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
  scrim: {flex: 1, backgroundColor: color.scrim, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32},
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
  error: {color: color.dangerInk},
});
