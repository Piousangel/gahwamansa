import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONT_SCALE_MAX, color, radius, shadow, touch} from './tokens';
import {Text20} from './Text20';
import {Icon} from './assets/icons';
import {announce} from './a11y';
import {ToastPlacementContext, toastBottom, type ToastPlacement} from './toastPlacement';
import {fadeMs, useReduceMotion} from './motion';

/** 자녀 토스트 유지 시간(README §13: 6초, 최소 5초). 오류는 자동으로 사라지지 않는다. */
export const TOAST_MS = 6000;

type ToastAction = {label: string; onPress: () => void};
/** 오류는 "다시 하기"가 필수(리뷰 M3: 자동으로 안 사라지니 닫을 길이 있어야 함). 누르면 토스트를 닫고 부른다 */
// durationMs: 이 토스트만 표시 시간을 따로(예: 응원 '취소' 가능 시간과 같게, UX U10). 없으면 TOAST_MS
export type ToastOptions =
  | {text: string; kind?: 'info'; action?: ToastAction; durationMs?: number}
  | {text: string; kind: 'error'; action: ToastAction; durationMs?: number};
type ToastApi = {show: (o: ToastOptions) => void; hide: () => void};

const Ctx = createContext<ToastApi | null>(null);

/** 자녀 화면 전용(어르신은 Banner). 한 번에 1개, 새 토스트가 이전 것을 바꾼다. */
export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) {
    throw new Error('useToast 는 ToastProvider 안에서만 쓸 수 있어요');
  }
  return api;
}

type Shown = ToastOptions & {id: number};

/**
 * 자녀 화면 루트에 한 번 둔다. bottomOffset = 탭 바 높이(탭 위에 띄움).
 * 자리(UX U2): 지금 화면의 하단 고정 위 12 → 없으면 탭 막대 위 12 → 없으면 안전 영역 + 24. 시트·대화상자가 열려 있으면 숨긴다(toastPlacement).
 * 접근성(TalkBack R11): 나타날 때 한 번만 읽는다(오류도 polite). 아이콘은 장식.
 */
export function ToastProvider({children, bottomOffset = 0}: {children: React.ReactNode; bottomOffset?: number}) {
  const [toast, setToast] = useState<Shown | null>(null);
  const seq = useRef(0);
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  // 지금 보이는 화면의 dock 높이(마지막으로 알린 화면), 열린 시트·대화상자 수
  const [dock, setDock] = useState<{id: object; h: number} | null>(null);
  const [modals, setModals] = useState(0);
  const placement = useMemo<ToastPlacement>(
    () => ({
      reportDock: (id, h) => setDock(cur => (h === null ? (cur && cur.id === id ? null : cur) : cur && cur.id === id && cur.h === h ? cur : {id, h})),
      modal: open => setModals(n => Math.max(0, n + (open ? 1 : -1))),
    }),
    [],
  );

  // 리뷰 L9: 사라지는 타이머를 담아 두고 언마운트·새 토스트 때 정리
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  useEffect(() => clearHide, []);

  const hide = useCallback(() => {
    const ms = fadeMs(reduce);
    if (ms > 0) {
      Animated.timing(opacity, {toValue: 0, duration: ms, useNativeDriver: true}).start();
    }
    const id = seq.current;
    clearHide();
    hideTimer.current = setTimeout(() => setToast(t => (t && t.id === id ? null : t)), ms);
  }, [opacity, reduce]);

  const show = useCallback((o: ToastOptions) => {
    clearHide();
    seq.current += 1;
    setToast({...o, id: seq.current});
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    announce(toast.text);
    const ms = fadeMs(reduce);
    if (ms > 0) {
      opacity.setValue(0);
      Animated.timing(opacity, {toValue: 1, duration: ms, useNativeDriver: true}).start();
    } else {
      opacity.setValue(1);
    }
    // 오류는 "다시 하기"를 누를 때까지 남긴다. 타입을 어기고 action 없이 오면 닫을 길이 없으니 자동으로 사라지게 한다
    if (toast.kind === 'error' && toast.action) {
      return;
    }
    const t = setTimeout(hide, toast.durationMs ?? TOAST_MS);
    return () => clearTimeout(t);
    // 토스트가 바뀔 때만(id) 다시 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  const api = useMemo(() => ({show, hide}), [show, hide]);
  const error = toast?.kind === 'error';

  return (
    <Ctx.Provider value={api}>
      <ToastPlacementContext.Provider value={placement}>{children}</ToastPlacementContext.Provider>
      {toast && modals === 0 ? (
        <View
          testID="toast-layer"
          pointerEvents="box-none"
          style={[styles.layer, {bottom: toastBottom({dock: dock?.h ?? 0, tabOffset: bottomOffset, insetBottom: insets.bottom})}]}>
          <Animated.View
            testID="toast"
            style={[styles.toast, error ? styles.errorBox : styles.infoBox, {opacity}]}>
            {error ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="icon-warning" size={24} color={color.dangerInk} />
              </View>
            ) : null}
            <Text20 size={20} weight="bold" style={[styles.text, error ? styles.errorText : styles.infoText]}>
              {toast.text}
            </Text20>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                onPress={() => {
                  hide();
                  toast.action?.onPress();
                }}
                style={({pressed}) => [styles.action, pressed ? styles.actionPressed : null]}>
                <Text20 size={20} weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={[styles.actionText, error ? styles.errorText : styles.infoText]}>
                  {toast.action.label}
                </Text20>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', left: 20, right: 20, alignItems: 'stretch'},
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch.childButton, borderRadius: radius.childCard,
    paddingVertical: 8, paddingHorizontal: 14, boxShadow: shadow.soft,
  },
  // 안내: 짙은 갈색 면 + 흰 글자(7.80) / 오류: 연빨강 면 + 3px 빨강 테두리 + 아이콘
  infoBox: {backgroundColor: color.inkTitle},
  errorBox: {backgroundColor: color.dangerSoft, borderWidth: 3, borderColor: color.danger},
  text: {flex: 1},
  infoText: {color: color.onAction},
  errorText: {color: color.dangerInk},
  action: {minHeight: touch.childRecommended, minWidth: touch.childRecommended, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  actionPressed: {opacity: 0.7},
  actionText: {textDecorationLine: 'underline'},
});
