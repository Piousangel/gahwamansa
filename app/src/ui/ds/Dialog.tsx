import React, {useEffect, useRef, type RefObject} from 'react';
import {Animated, Modal, ScrollView, StyleSheet, View} from 'react-native';
import {color as v3color} from '../tokens';
import {useModalFocus} from '../a11y';
import {useToastModalGuard} from '../toastPlacement';
import {useFadeIn} from '../useFadeIn';
import {AudienceProvider, useAudience} from './audience';
import {Button} from './Button';
import {Text} from './Text';
import {dismissLabel, type Dismiss} from './dismiss';
import {ds} from './roles';

const c = ds.color;

export type DialogAction = {
  label: string;
  onPress: () => void;
  /** 되돌릴 수 없는 행동이면 danger — 그때는 닫는 쪽이 위(안전한 쪽이 주, A5 규칙 1:114) */
  kind?: 'primary' | 'danger';
  loading?: boolean;
  loadingLabel?: string;
};

export type DialogProps = {
  visible: boolean;
  title: string;
  body?: string;
  /** 제목 아래·본문 위 내용. 본문과 같은 스크롤 안이라 200%에서도 버튼은 아래에 남는다 */
  children?: React.ReactNode;
  /** 하는 쪽(하나). 없으면 닫기만 있는 안내 대화상자 */
  action?: DialogAction;
  /** 닫는 쪽 말 — 세 갈래로만(A5·W-09). 문자열을 받지 않는다 */
  dismiss: Dismiss;
  /** 닫는 쪽 버튼·안드로이드 뒤로(밖 누르기로는 닫히지 않는다 — 실수로 닫히지 않게) */
  onDismiss: () => void;
  /** 닫히면 포커스를 돌려줄 요소(R12). 덮개(사용자가 열지 않음)는 null 을 넘긴다 */
  returnFocusRef: RefObject<unknown> | null;
  /** 대화상자 안 오류 한 줄(모달 위 토스트는 보이지 않는다) */
  error?: string | null;
  testID?: string;
};

/**
 * v4 대화상자(D-04). 어르신·자녀 공용(audience 를 그대로 넘긴다). 지금 하던 일을 멈추고 꼭 답할 때만.
 * - 버튼은 둘까지: 하는 쪽(action) + 닫는 쪽(dismiss). 닫는 말은 '닫기'·'다음에'·'안 ○○할게요' 중 하나(타입으로 강제).
 * - 되돌릴 수 있으면 하는 쪽이 위(주), 되돌릴 수 없으면(danger) 닫는 쪽이 위(주) — 안전한 쪽이 먼저 손에 닿게.
 * - 사용자가 열지 않은 덮개로 띄울 때는 visible 을 useCover(id, 원함).visible 로 준다(하루 하나, A8).
 * - 접근성: Modal(별도 창) + accessibilityViewIsModal, 열리면 제목으로·닫히면 연 버튼으로 포커스, 모션은 불투명도만.
 */
export function Dialog(props: DialogProps) {
  const a = useAudience();
  return (
    <AudienceProvider value={a}>
      <DialogInner {...props} />
    </AudienceProvider>
  );
}

function DialogInner({visible, title, body, children, action, dismiss, onDismiss, returnFocusRef, error, testID = 'ds-dialog'}: DialogProps) {
  const a = useAudience();
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  const openFocus = useModalFocus(visible, titleRef, returnFocusRef ?? undefined);
  useToastModalGuard(visible);
  const {opacity, start} = useFadeIn(visible);
  // 두 번 누름 방지: 한 번 누르면 다시 그려질 때(로딩·오류)까지 무시
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [action, visible, error]);
  const once = (fn: () => void) => () => {
    if (fired.current) {
      return;
    }
    fired.current = true;
    fn();
  };
  const danger = action?.kind === 'danger';
  const doIt = action ? (
    <Button
      key="do"
      kind={danger ? 'danger' : 'primary'}
      label={action.label}
      loading={action.loading}
      loadingLabel={action.loadingLabel}
      onPress={once(action.onPress)}
      testID={`${testID}-action`}
    />
  ) : null;
  const close = (
    <Button key="close" kind={danger || !action ? 'primary' : 'secondary'} label={dismissLabel(dismiss)} onPress={once(onDismiss)} disabled={action?.loading} testID={`${testID}-dismiss`} />
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        start();
        openFocus();
      }}
      onRequestClose={() => {
        if (!action?.loading) {
          onDismiss();
        }
      }}>
      <Animated.View testID={`${testID}-scrim`} style={[styles.scrim, {opacity, paddingHorizontal: ds.space.screenX[a]}]}>
        <View testID={testID} role="alertdialog" accessibilityViewIsModal style={styles.card}>
          {/* 머리글은 바깥 View 하나(포커스 대상). 안 글자는 머리글 역할 없이 — 같은 제목을 두 번 읽지 않게 */}
          <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
            <Text role="title">{title}</Text>
          </View>
          {body || children ? (
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
              {children}
              {body ? <Text role="bodyLg">{body}</Text> : null}
            </ScrollView>
          ) : null}
          <View accessibilityLiveRegion="polite">
            {error ? (
              <Text role="body" tone="danger" testID={`${testID}-error`}>
                {error}
              </Text>
            ) : null}
          </View>
          <View testID={`${testID}-actions`} style={styles.actions}>
            {danger || !action ? [close, doIt] : [doIt, close]}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {flex: 1, backgroundColor: v3color.scrim, justifyContent: 'center', paddingVertical: 32}, // 좌우 여백은 audience 별(리뷰 L1)
  card: {backgroundColor: c.card, borderRadius: ds.radius.sheet, paddingHorizontal: 20, paddingVertical: 24, gap: 12, maxHeight: '100%'},
  // 200%에서 화면을 넘으면 본문만 스크롤, 버튼은 아래에 남는다
  bodyScroll: {flexGrow: 0, flexShrink: 1},
  bodyContent: {gap: 12, paddingBottom: 4},
  actions: {gap: ds.touch.elder.gap, marginTop: 4},
});
