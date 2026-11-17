import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {color, radius, shadow, touch} from './tokens';
import {ChildText} from './ChildText';
import {Icon} from './assets/icons';
import {announce} from './a11y';
import {fadeMs, useReduceMotion} from './motion';

/** 자녀 토스트 유지 시간(README §13: 6초, 최소 5초). 오류는 자동으로 사라지지 않는다. */
export const TOAST_MS = 6000;

export type ToastOptions = {
  text: string;
  kind?: 'info' | 'error';
  /** 오류일 때 "다시 하기". 누르면 토스트를 닫고 부른다 */
  action?: {label: string; onPress: () => void};
};
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
 * 접근성(TalkBack R11): 나타날 때 한 번만 읽는다(오류도 polite). 아이콘은 장식.
 */
export function ToastProvider({children, bottomOffset = 0}: {children: React.ReactNode; bottomOffset?: number}) {
  const [toast, setToast] = useState<Shown | null>(null);
  const seq = useRef(0);
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    const ms = fadeMs(reduce);
    if (ms > 0) {
      Animated.timing(opacity, {toValue: 0, duration: ms, useNativeDriver: true}).start();
    }
    const id = seq.current;
    setTimeout(() => setToast(t => (t && t.id === id ? null : t)), ms);
  }, [opacity, reduce]);

  const show = useCallback((o: ToastOptions) => {
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
    if (toast.kind === 'error') {
      return;
    }
    const t = setTimeout(hide, TOAST_MS);
    return () => clearTimeout(t);
    // 토스트가 바뀔 때만(id) 다시 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  const api = useMemo(() => ({show, hide}), [show, hide]);
  const error = toast?.kind === 'error';

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.layer, {bottom: bottomOffset + Math.max(16, insets.bottom)}]}>
          <Animated.View
            testID="toast"
            style={[styles.toast, error ? styles.errorBox : styles.infoBox, {opacity}]}>
            {error ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="icon-warning" size={24} color={color.dangerInk} />
              </View>
            ) : null}
            <ChildText size={16} weight="bold" style={[styles.text, error ? styles.errorText : styles.infoText]}>
              {toast.text}
            </ChildText>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                onPress={() => {
                  hide();
                  toast.action?.onPress();
                }}
                style={({pressed}) => [styles.action, pressed ? styles.actionPressed : null]}>
                <ChildText size={16} weight="bold" scale="button" style={[styles.actionText, error ? styles.errorText : styles.infoText]}>
                  {toast.action.label}
                </ChildText>
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
