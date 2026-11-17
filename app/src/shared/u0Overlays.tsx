// TODO(U0 합치기): 이 파일은 U0 줄의 표준 BottomSheet·Dialog·Toast 가 들어올 자리의 얇은 대역(stand-in)이다.
// 자녀 화면은 여기 이름(useToast·BottomSheet·Dialog)만 쓴다. U0 를 합칠 때 이 파일을 지우고 import 경로만 U0 로 바꾼다.
// ui/ 에 같은 역할 컴포넌트를 만들지 않는다(ARCHITECTURE §9). 동작은 최소: 움직임 없음, 바깥 누르면 닫힘, 토스트 3초.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text20} from '../ui/Text20';
import {color, radius, size, space} from '../ui/tokens';

export const TOAST_MS = 3000;

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setText(t);
    timer.current = setTimeout(() => setText(null), TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );
  const toast = text ? (
    <View testID="toast" pointerEvents="none" style={styles.toastWrap}>
      <View style={styles.toast}>
        <Text20 weight="bold" accessibilityLiveRegion="polite" style={styles.toastText}>
          {text}
        </Text20>
      </View>
    </View>
  ) : null;
  return {toast, show};
}

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

// 시트: 화면 위 64를 남기고 가운데만 스크롤, 버튼은 시트 아래 고정(시안 노트 4차).
export function BottomSheet({visible, onClose, closeLabel, title, hint, children, footer}: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.gap} onPress={onClose} accessibilityElementsHidden importantForAccessibility="no" />
        <View testID="sheet" style={[styles.sheet, {paddingBottom: Math.max(space.xl, insets.bottom + 12)}]}>
          <View style={styles.head}>
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} hitSlop={8} style={styles.close}>
              <Text20 weight="bold">{closeLabel}</Text20>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            <Text20 size={28} weight="bold" accessibilityRole="header">{title}</Text20>
            {hint ? <Text20 style={styles.hint}>{hint}</Text20> : null}
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

type DialogProps = {visible: boolean; onClose: () => void; title: string; body?: string; children: React.ReactNode};

export function Dialog({visible, onClose, title, body, children}: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, styles.center]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityElementsHidden importantForAccessibility="no" />
        <View testID="dialog" accessibilityViewIsModal style={styles.dialog}>
          <Text20 size={28} weight="bold" accessibilityRole="header">{title}</Text20>
          {body ? <Text20>{body}</Text20> : null}
          <View>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toastWrap: {position: 'absolute', left: 16, right: 16, top: 96, alignItems: 'center'},
  toast: {backgroundColor: color.inkTitle, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 20},
  toastText: {color: color.onAction, textAlign: 'center'},
  gap: {flex: 1, minHeight: 64},
  backdrop: {flex: 1, backgroundColor: 'rgba(78,47,20,0.45)'},
  center: {justifyContent: 'center', padding: 20},
  sheet: {backgroundColor: color.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, maxHeight: '100%'},
  head: {flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8},
  close: {minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'center'},
  body: {paddingHorizontal: 24, gap: 12, paddingBottom: 8},
  hint: {color: color.inkSub},
  footer: {paddingHorizontal: 24, paddingTop: 8},
  dialog: {backgroundColor: color.paper, borderRadius: radius.sheet, padding: 24, gap: 12},
});
