import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONT_SCALE_MAX, color, radius, shadow, touch} from './tokens';
import {Text20} from './Text20';
import {Icon} from './assets/icons';
import {announce} from './a11y';
import {focusLater, FOCUS_DELAY_MS} from './screenTitle';
import {ToastPlacementContext, toastBottom, type ToastPlacement} from './toastPlacement';
import {fadeMs, useReduceMotion} from './motion';

/** 자녀 토스트 유지 시간(README §13: 6초, 최소 5초). 오류는 자동으로 사라지지 않는다. */
export const TOAST_MS = 6000;

type ToastAction = {label: string; onPress: () => void};
/** 오류는 "다시 하기"가 필수(리뷰 M3: 자동으로 안 사라지니 닫을 길이 있어야 함). 누르면 토스트를 닫고 부른다 */
// durationMs: 이 토스트만 표시 시간을 따로(예: 응원 '취소' 가능 시간과 같게, UX U10). 없으면 TOAST_MS
// onExpire: 행동(action)을 누르지 않고 이 토스트가 끝날 때 한 번(시간 끝·hide·새 토스트로 바뀜·제공자 언마운트).
//   끝나기 시작하는 순간 행동 버튼은 비활성이 된다(리뷰 M2: 응원은 이 시점에 보내므로 보낸 뒤 '취소'를 누를 틈이 없다)
// focusAction: 나타날 때 화면 읽기 초점을 행동 버튼으로(전문가 리뷰 D-17a, WCAG 2.2.1 — 화면 읽기 사용자가 시간 안에 닿게).
//   이때는 따로 읽어 주지 않고 버튼 라벨을 '{문구}, {행동}'으로 둔다(한 번만 읽힘, R11). 시트가 닫히며 연 버튼으로 돌아가는 초점(300ms)보다 뒤에 옮긴다.
type Extra = {durationMs?: number; onExpire?: () => void; focusAction?: boolean};
export type ToastOptions =
  | ({text: string; kind?: 'info'; action?: ToastAction} & Extra)
  | ({text: string; kind: 'error'; action: ToastAction} & Extra);
/** show 는 토스트 id 를 돌려준다. hide(id) 는 그 토스트가 아직 떠 있을 때만 닫는다 */
type ToastApi = {show: (o: ToastOptions) => number; hide: (id?: number) => void};

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

  // 지금 토스트(onExpire 를 부르려고 렌더와 별도로 둔다)·끝나기 시작한 토스트 id·행동을 누른 토스트 id
  const current = useRef<Shown | null>(null);
  const [leaving, setLeaving] = useState<number | null>(null);
  const expire = useCallback(() => {
    const t = current.current;
    current.current = null;
    if (t) {
      setLeaving(t.id);
      t.onExpire?.();
    }
  }, []);
  useEffect(() => () => expire(), [expire]);

  const hide = useCallback(
    (only?: number) => {
      if (only !== undefined && only !== seq.current) {
        return;
      }
      expire();
      const ms = fadeMs(reduce);
      if (ms > 0) {
        Animated.timing(opacity, {toValue: 0, duration: ms, useNativeDriver: true}).start();
      }
      const id = seq.current;
      clearHide();
      hideTimer.current = setTimeout(() => setToast(t => (t && t.id === id ? null : t)), ms);
    },
    [opacity, reduce, expire],
  );

  const show = useCallback(
    (o: ToastOptions) => {
      expire(); // 바뀌는 토스트도 끝난 것
      clearHide();
      seq.current += 1;
      const next = {...o, id: seq.current};
      current.current = next;
      setToast(next);
      return next.id;
    },
    [expire],
  );

  // 행동을 누르면 onExpire 없이 닫는다
  const act = useCallback(
    (t: Shown) => {
      if (current.current?.id !== t.id) {
        return; // 이미 끝나기 시작함(비활성)
      }
      current.current = null;
      hide();
      t.action?.onPress();
    },
    [hide],
  );

  // 리뷰 L3: 시트·대화상자가 열려 숨긴 동안에는 읽지도 시간을 세지도 않는다. 닫히면 그때 읽고 처음부터 센다
  const visible = !!toast && modals === 0;
  const announced = useRef(0);
  const actionRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const focusing = !!toast?.focusAction && !!toast.action;
  useEffect(() => {
    if (!toast || !visible) {
      return;
    }
    let cancelFocus: (() => void) | undefined;
    if (announced.current !== toast.id) {
      announced.current = toast.id;
      if (focusing) {
        cancelFocus = focusLater(() => actionRef.current, FOCUS_DELAY_MS * 2);
      } else {
        announce(toast.text);
      }
    }
    const ms = fadeMs(reduce);
    if (ms > 0) {
      opacity.setValue(0);
      Animated.timing(opacity, {toValue: 1, duration: ms, useNativeDriver: true}).start();
    } else {
      opacity.setValue(1);
    }
    // 오류는 "다시 하기"를 누를 때까지 남긴다. 타입을 어기고 action 없이 오면 닫을 길이 없으니 자동으로 사라지게 한다
    if (toast.kind === 'error' && toast.action) {
      return cancelFocus;
    }
    const id = toast.id;
    const t = setTimeout(() => hide(id), toast.durationMs ?? TOAST_MS);
    return () => {
      clearTimeout(t);
      cancelFocus?.();
    };
    // 토스트가 바뀌거나 보이기 시작할 때만 다시 센다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id, visible]);

  const api = useMemo(() => ({show, hide}), [show, hide]);
  const error = toast?.kind === 'error';

  return (
    <Ctx.Provider value={api}>
      <ToastPlacementContext.Provider value={placement}>{children}</ToastPlacementContext.Provider>
      {toast && visible ? (
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
                ref={actionRef}
                testID="toast-action"
                accessibilityRole="button"
                accessibilityLabel={focusing ? `${toast.text}, ${toast.action.label}` : toast.action.label}
                disabled={leaving === toast.id}
                accessibilityState={{disabled: leaving === toast.id}}
                onPress={() => act(toast)}
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
