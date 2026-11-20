import React, {useEffect, useRef, useState, type RefObject} from 'react';
import {Animated, Modal, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {useModalFocus} from '../a11y';
import {useToastModalGuard} from '../toastPlacement';
import {useFadeIn} from '../useFadeIn';
import {AudienceProvider, useAudience} from './audience';
import {Button} from './Button';
import {Text} from './Text';
import {dismissLabel, type Dismiss} from './dismiss';
import {ds} from './roles';
import {Tag} from './Tag';
import {MoreBand} from './MoreBand';

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
  /** 하는 쪽 버튼 바로 아래 한 줄(누르면 무엇이 이어지는지 미리 알림, 예: N1 '휴대폰이 한 번 더 물어봐요'). 버튼 힌트로도 읽는다 */
  actionHint?: string;
  /** 닫는 쪽 말 — 세 갈래로만(A5·W-09). 문자열을 받지 않는다 */
  dismiss: Dismiss;
  /** 닫는 쪽 버튼·안드로이드 뒤로(밖 누르기로는 닫히지 않는다 — 실수로 닫히지 않게) */
  onDismiss: () => void;
  /** 안드로이드 뒤로가 닫는 쪽 버튼과 뜻이 다를 때만. 예: N1 은 '안 받을게요' = 거절 기록, 뒤로 = 오늘은 넘김(PR #72 M1). 없으면 onDismiss */
  onBack?: () => void;
  /** 닫히면 포커스를 돌려줄 요소(R12). 덮개(사용자가 열지 않음)는 null 을 넘긴다 */
  returnFocusRef: RefObject<unknown> | null;
  /** 제목 위 위험 띠(예: P9 '되돌릴 수 없어요'). 되돌릴 수 없는 행동(action.kind danger)과 함께만 쓴다. 200%에서 카드 폭 안에서 줄바꿈(#194·#200) */
  warning?: string;
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

function DialogInner({visible, title, body, children, action, actionHint, dismiss, onDismiss, onBack, returnFocusRef, warning, error, testID = 'ds-dialog'}: DialogProps) {
  const a = useAudience();
  // 글자 150% 이상이면 미리 알림 줄은 본문 스크롤 끝으로(버튼 묶음은 스크롤 밖이라 줄이 늘면 닫는 쪽이 잘린다 — #168 접근성 재확인 M). 버튼 힌트는 그대로
  const hintInBody = useWindowDimensions().fontScale >= 1.5 && !!(body || children);
  const hintLine = actionHint && action && !(action.kind === 'danger') ? <Hint key="hint" text={actionHint} testID={`${testID}-action-hint`} /> : null;
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
  // 본문 넘침(R-19): 창·내용·위치를 재서 끝까지 안 내렸으면 띠
  const m = useRef({view: 0, content: 0, y: 0});
  const [more, setMore] = useState(false);
  const measure = (next: Partial<{view: number; content: number; y: number}>) => {
    m.current = {...m.current, ...next};
    const {view, content, y} = m.current;
    setMore(view > 0 && content > view + 1 && y + view < content - 4);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
    measure({view: layoutMeasurement.height, content: contentSize.height, y: contentOffset.y});
  };
  const danger = action?.kind === 'danger';
  const doIt = action ? (
    <Button
      key="do"
      kind={danger ? 'danger' : 'primary'}
      label={action.label}
      loading={action.loading}
      loadingLabel={action.loadingLabel}
      accessibilityHint={actionHint}
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
          (onBack ?? onDismiss)();
        }
      }}>
      <Animated.View testID={`${testID}-scrim`} style={[styles.scrim, {opacity, paddingHorizontal: ds.space.screenX[a]}]}>
        <View testID={testID} role="alertdialog" accessibilityViewIsModal style={styles.card}>
          {/* 200%·좁은 폭에서 넘치면 띠·제목·본문이 함께 스크롤되고 버튼 묶음만 밖(아래)에 남는다(#217 리뷰 M, 방법 1) */}
          <ScrollView
            testID={`${testID}-scroll`}
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            scrollEventThrottle={64}
            onLayout={e => measure({view: e.nativeEvent.layout.height})}
            onContentSizeChange={(_w, h) => measure({content: h})}
            onScroll={onScroll}
            onScrollEndDrag={onScroll}
            onMomentumScrollEnd={onScroll}>
            {warning ? <WarningBand text={warning} testID={`${testID}-warning`} /> : null}
            {/* 머리글은 바깥 View 하나(포커스 대상). 안 글자는 머리글 역할 없이 — 같은 제목을 두 번 읽지 않게.
                warning 이 있으면 열릴 때 초점(제목)에서 띠를 먼저 읽는다 — 띠만 따로 두면 화면 읽기 사용자가 듣지 못한 채 위험 버튼에 닿는다(#217 리뷰 M) */}
            <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={warning ? `${warning}. ${title}` : title}>
              <Text role="title">{title}</Text>
            </View>
            {children}
            {body ? <Text role="bodyLg">{body}</Text> : null}
            {hintInBody ? hintLine : null}
          </ScrollView>
          {/* 200% 등에서 넘치면 '더 있음' 띠(R-19). 끝까지 내리면 사라진다 */}
          {more ? <MoreBand /> : null}
          {/* 오류가 없으면 칸이 간격을 차지하지 않게 display none(#217 리뷰 L) — 알림 영역(live region)은 그대로 두어 오류가 생길 때 읽힌다 */}
          <View testID={`${testID}-error-region`} accessibilityLiveRegion="polite" style={error ? null : styles.none}>
            {error ? (
              <Text role="body" tone="danger" testID={`${testID}-error`}>
                {error}
              </Text>
            ) : null}
          </View>
          <View testID={`${testID}-actions`} style={styles.actions}>
            {danger || !action ? [close, doIt] : [doIt, hintInBody ? null : hintLine, close]}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// 위험 띠 = ds Tag danger 변형(R-04 예외는 Tag 하나로 덮인다, #217 리뷰 L). 화면 읽기에서는 숨기고 제목 라벨이 함께 읽는다
function WarningBand({text, testID}: {text: string; testID: string}) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`${testID}-hidden`}>
      <Tag label={text} tone="danger" icon="icon-warning" testID={testID} />
    </View>
  );
}

// 하는 쪽 버튼 아래 미리 알림 한 줄(버튼 힌트로도 읽으므로 화면 읽기에서는 숨긴다)
function Hint({text, testID}: {text: string; testID: string}) {
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text role="sub" style={styles.hint} testID={testID}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {textAlign: 'center', marginTop: -4},
  none: {display: 'none'},
  scrim: {flex: 1, backgroundColor: ds.scrim, justifyContent: 'center', paddingVertical: 32}, // 좌우 여백은 audience 별(리뷰 L1)
  card: {backgroundColor: c.card, borderRadius: ds.radius.sheet, paddingHorizontal: 20, paddingVertical: 24, gap: 12, maxHeight: '100%'},
  // 200%에서 화면을 넘으면 본문만 스크롤, 버튼은 아래에 남는다
  bodyScroll: {flexGrow: 0, flexShrink: 1},
  bodyContent: {gap: 12, paddingBottom: 4},
  actions: {gap: ds.touch.elder.gap, marginTop: 4},
});
