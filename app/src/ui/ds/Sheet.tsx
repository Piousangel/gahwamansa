import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {
  Animated as RNAnimated,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {Extrapolation, interpolate, ReduceMotion, useAnimatedStyle} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useModalFocus} from '../a11y';
import {useToastModalGuard} from '../toastPlacement';
import {useFadeIn} from '../useFadeIn';
import {AudienceProvider, useAudience} from './audience';
import {Heading, Text} from './Text';
import {MoreBand} from './MoreBand';
import {ds} from './roles';
import {dismissLabel} from './dismiss';

const c = ds.color;
/** 시트 높이 상한(화면 높이 비율, 시안 C4_cheer_sheet_ds4) — 손잡이 줄 포함 */
export const SHEET_MAX_RATIO = 0.88;
/** 닫기 알약 최소 크기(48×48) */
const CLOSE_MIN = 48;
/** 손잡이 줄 높이 = 최소 누르기 크기 48(닫기 알약과 같은 규칙, Material 3 시트 손잡이도 48dp). 막대는 40×5 */
export const SHEET_HANDLE_H = 48;
/** gorhom 이 끌어 닫은 뒤(onClose) 부모가 이 시간(ms) 안에 visible 을 끄지 않으면(닫기를 막은 호출부) 시트를 제자리로 되돌린다 — 보이지 않는 Modal 이 화면을 막지 않게 */
const CLOSE_GUARD_MS = 120;

/** 손잡이의 스크린리더 말(컴포넌트 계약의 고정 말 — ui 는 copy 를 모른다, ARCHITECTURE 2절·dismiss.ts 와 같은 방식) */
export const SHEET_HANDLE_TEXT = {
  label: '시트 손잡이',
  /** 멈출 칸이 하나: 두 번 누르기 = 닫기 */
  hintClose: '두 번 누르면 닫혀요',
  /** 멈출 칸이 여럿: 위아래로 쓸어 크기 조절(닫기는 X·뒤로 가기) */
  hintAdjust: '위아래로 쓸어 크기를 바꿔요',
  level: (now: number, max: number) => `${max}단계 중 ${now}단계`,
} as const;

/** 멈출 높이: px · 화면 높이의 '%' · 'content'(내용 높이, 상한 88%) */
export type SnapPoint = number | `${number}%` | 'content';

export type SheetProps = {
  visible: boolean;
  title: string;
  /** 제목 아래 보조 한 줄(sub) */
  sub?: string;
  /** X·밖 누르기·안드로이드 뒤로·끌어 내리기 */
  onClose: () => void;
  /** 닫히면 포커스를 돌려줄 요소(이 시트를 연 버튼, R12). 필수 — 공용 부품이라 쓰는 곳마다 빠뜨리지 않게(PR #93 M1) */
  returnFocusRef: RefObject<unknown>;
  children?: React.ReactNode;
  /** 스크롤 밖 아래에 고정되는 줄(주 버튼·오류 줄). 선택지가 많아도 저장 버튼을 찾으러 내려가지 않게(C7 부르는 이름) */
  footer?: React.ReactNode;
  /**
   * 멈출 높이들: px · 화면 높이의 '%' · 'content'(내용 높이). 기본 ['content'] 하나(지금까지와 같은 모양).
   * 시트 높이(내용, 상한 88%)를 넘는 값은 시트 높이로 자른다(resolveSnapPoints). 쓸 칸이 하나도 없으면 'content'.
   */
  snapPoints?: readonly SnapPoint[];
  /**
   * 처음 열 칸(낮은 것부터 0). 기본 가장 높은 칸. 열 때 한 번 정한다(열려 있는 동안 내용 높이가 바뀌어도 사용자가 고른 칸을 덮지 않게).
   * 낮은 칸은 시트 아랫부분이 화면 밖이다 → footer(주 버튼)가 있는 시트에 낮은 칸을 쓰지 않는다(지금 사용처는 모두 기본 한 칸).
   */
  initialSnap?: number;
  testID?: string;
};

const DEFAULT_SNAPS: readonly SnapPoint[] = ['content'];

/**
 * 우리 멈출 높이 → gorhom 설정. 'content' 는 gorhom 동적 높이(enableDynamicSizing)가 맡고, 나머지는 px 로 바꿔
 * 시트 높이(sheetH, 재기 전 0)로 자른다. 동적 높이와 같거나 넘는 칸은 그 칸과 겹치므로 뺀다. 결과는 낮은 것부터.
 * 쓸 칸이 하나도 없으면(빈 배열 등) 'content' 하나로 — gorhom 은 빈 칸 목록에서 멈춘다(리뷰).
 */
export function resolveSnapPoints(snaps: readonly SnapPoint[], windowH: number, sheetH: number): {points: number[]; dynamic: boolean; count: number} {
  const dynamic = snaps.includes('content');
  const px = snaps
    .filter((s): s is number | `${number}%` => s !== 'content')
    .map(s => (typeof s === 'number' ? s : (windowH * parseFloat(s)) / 100))
    .map(v => Math.round(sheetH > 0 ? Math.min(v, sheetH) : v))
    .filter(v => v > 0 && !(dynamic && sheetH > 0 && v >= sheetH - 0.5));
  const points = [...new Set(px)].sort((a, b) => a - b);
  if (!dynamic && points.length === 0) {
    return {points: [], dynamic: true, count: 1};
  }
  return {points, dynamic, count: points.length + (dynamic ? 1 : 0)};
}

type HandleCtx = {multi: boolean; level: number; max: number; onAction: (e: AccessibilityActionEvent) => void};
const SheetHandleContext = createContext<HandleCtx>({multi: false, level: 1, max: 1, onAction: () => {}});
const SheetCloseContext = createContext<() => void>(() => {});
type FooterCtx = {testID: string; footer?: React.ReactNode; canScroll: boolean; more: boolean; insetBottom: number};
const SheetFooterContext = createContext<FooterCtx>({testID: '', canScroll: false, more: false, insetBottom: 0});

/**
 * 손잡이(gorhom handleComponent). gorhom 이 이 줄 전체에 끌기 제스처를 붙인다.
 * 스크린리더: 칸이 하나면 손잡이 = 닫기 버튼(두 번 누르기), 여럿이면 조절 막대(위아래 쓸기 = 한 칸, 닫기는 X·뒤로).
 * gorhom 은 그릴 때마다 새 컴포넌트를 받으면 손잡이를 다시 만들므로 모듈 상수로 두고 값은 문맥으로 받는다(배경·아래 줄도 같음).
 */
function SheetHandle() {
  const {multi, level, max, onAction} = useContext(SheetHandleContext);
  const a11y = multi
    ? {
        accessibilityRole: 'adjustable' as const,
        accessibilityHint: SHEET_HANDLE_TEXT.hintAdjust,
        accessibilityValue: {min: 1, max, now: level, text: SHEET_HANDLE_TEXT.level(level, max)},
        accessibilityActions: [{name: 'increment' as const}, {name: 'decrement' as const}],
      }
    : {
        accessibilityRole: 'button' as const,
        accessibilityHint: SHEET_HANDLE_TEXT.hintClose,
        accessibilityActions: [{name: 'activate' as const}],
      };
  return (
    <View testID="sheet-handle" accessible accessibilityLabel={SHEET_HANDLE_TEXT.label} {...a11y} onAccessibilityAction={onAction} style={styles.handleRow}>
      <View style={styles.handleBar} />
    </View>
  );
}

/** 배경(밖 누르기 = 닫기). 진하기는 gorhom 칸 번호로: 닫힘(-1) 0 → 가장 낮은 칸(0) 1. 화면 읽기에서는 X 가 같은 일을 하므로 숨긴다 */
function SheetBackdrop({animatedIndex, style}: BottomSheetBackdropProps) {
  const onClose = useContext(SheetCloseContext);
  const fade = useAnimatedStyle(() => ({opacity: interpolate(animatedIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP)}));
  return (
    <Animated.View testID="sheet-scrim-fade" style={[style, fade]}>
      <Pressable testID="sheet-scrim" style={styles.scrim} onPress={onClose} accessible={false} importantForAccessibility="no" />
    </Animated.View>
  );
}

/**
 * 시트 바탕. gorhom 기본 바탕은 스크린리더에 'Bottom Sheet' 조절 막대로 읽히므로(접근성 계약과 다름) 읽히지 않는 바탕으로 바꾼다.
 * 위로 과도 당김의 바닥 틈은 gorhom 이 내용 칸 아래 여백(overDragSafePaddingBottom)으로 이미 채운다.
 */
function SheetBackground({style}: BottomSheetBackgroundProps) {
  return <View pointerEvents="none" style={style} accessible={false} importantForAccessibility="no-hide-descendants" />;
}

/**
 * 스크롤 밖 아래 줄(gorhom footerComponent): '더 있음' 띠 → 호출부 footer → 아래 inset(3버튼 내비·홈 인디케이터) 여백.
 * gorhom 이 이 줄 높이만큼 스크롤 내용 아래 여백을 더한다(enableFooterMarginAdjustment) → 내용·띠·footer 모두 내비 위.
 * 띠는 넘칠 때만 두고, 끝까지 내리면 높이는 그대로 둔 채 숨긴다 — 높이가 바뀌면 스크롤 아래 여백이 바뀌어 끝에서 튄다.
 */
function SheetFooter({animatedFooterPosition}: BottomSheetFooterProps) {
  const {testID, footer, canScroll, more, insetBottom} = useContext(SheetFooterContext);
  return (
    <BottomSheetFooter animatedFooterPosition={animatedFooterPosition}>
      <View testID={`${testID}-bottom`} style={[styles.bottom, {paddingBottom: insetBottom}]}>
        {canScroll ? (
          <View testID={`${testID}-more`} style={more ? null : styles.hidden}>
            <MoreBand />
          </View>
        ) : null}
        {footer ? (
          <View testID={`${testID}-footer`} style={styles.footer}>
            {footer}
          </View>
        ) : null}
      </View>
    </BottomSheetFooter>
  );
}

/**
 * v4 아래 시트(시안 child/C4_cheer_sheet_ds4, UX 깊이 V14). 자녀 전용(어르신은 Dialog).
 * - 머리: 손잡이 막대 + 제목(Heading 2) + 닫기 48×48 알약.
 * - 끌기(오너 C-3·O-3, 11-25): @gorhom/bottom-sheet. 손잡이·내용을 손가락으로 끌어 올리고 내리고, 아래로 끌어 닫는다.
 *   제스처·이동은 UI 스레드(Reanimated worklet + Gesture Handler)라 JS 가 바빠도 손가락을 따른다.
 *   안쪽 스크롤(BottomSheetScrollView, 시트의 바로 아래 자식이어야 gorhom 이 스크롤로 안다)과 끌기를 동시에 인식해
 *   스크롤이 맨 위면 내용을 아래로 끌어 닫는다 — 200%로 넘치는 시트도(#232 의 남은 한계 해소).
 * - 높이는 내용만큼(gorhom 동적 높이), 화면의 88%까지. 넘치면 시트 안에서만 스크롤 + 아래 '더 있음' 띠(R-19, 넘칠 때만).
 * - 글자는 역할 상한(선택지 bodyLg 2.0) — 150%로 묶지 않는다(V14 ③).
 * - 닫는 길: X · 밖 누르기 · 안드로이드 뒤로(Modal) · 끌어 내리기 · 스크린리더로 손잡이 두 번 누르기(칸이 하나일 때).
 * - Modal(별도 창) 안에 GestureHandlerRootView 를 한 번 더 둔다(Android Modal 은 앱 뿌리의 제스처 뿌리 밖, 공식 안내).
 * - 열리면 포커스가 제목으로, 닫히면 연 버튼으로. 여는 모션은 불투명도만(공용 모션 규칙 §0-6 — gorhom 올라오기 끔),
 *   손가락을 따르는 이동·놓은 뒤 자리 잡기만 위치가 바뀐다. 모션 줄이기면 gorhom 이 시스템 설정을 따라 바로 그 자리.
 * - 입력 없는 시트 전용: 자판 처리가 없다. 입력이 든 시트를 옮길 때 BottomSheetTextInput 과 함께 더한다(PR #93 L3).
 */
export function Sheet(props: SheetProps) {
  // 시트는 Modal(별도 창)이라 화면의 AudienceProvider 가 닿지 않을 수 있어 바깥 audience 를 그대로 넘긴다
  const a = useAudience();
  return (
    <AudienceProvider value={a}>
      <SheetInner {...props} />
    </AudienceProvider>
  );
}

function SheetInner({visible, title, sub, onClose, returnFocusRef, children, footer, snapPoints = DEFAULT_SNAPS, initialSnap, testID = 'ds-sheet'}: SheetProps) {
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  const openFocus = useModalFocus(visible, titleRef, returnFocusRef);
  useToastModalGuard(visible); // 열려 있는 동안 토스트를 띄우지 않는다(UX U2)
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const {opacity, start} = useFadeIn(visible);
  const [view, setView] = useState(0);
  // 스크롤 내용 높이(gorhom 이 더한 아래 줄 여백 포함) = 손잡이 아래 시트 몸통의 자연 높이
  const [content, setContent] = useState(0);
  const [y, setY] = useState(0);
  const canScroll = content > view + 1;
  // 넘칠 때만, 끝까지 내리면 숨긴다(옛 Screen measure 와 같은 식, PR #93 L1)
  const more = canScroll && y + view < content - 2;

  const maxSheet = Math.floor(height * SHEET_MAX_RATIO);
  const sheetH = content > 0 ? Math.min(maxSheet, content + SHEET_HANDLE_H) : 0;
  const snapKey = JSON.stringify(snapPoints); // 인라인 배열을 넘겨도 그릴 때마다 다시 계산하지 않게 값으로 비교
  const snaps = useMemo(() => resolveSnapPoints(JSON.parse(snapKey) as SnapPoint[], height, sheetH), [snapKey, height, sheetH]);
  const last = snaps.count - 1;
  const initialIdx = Math.max(0, Math.min(last, initialSnap ?? last));

  // gorhom index 는 바뀔 때마다 그 칸으로 스냅한다 → 열 때 한 번 정해 둔다(리뷰). 지금 칸(idx)은 gorhom onChange 로 따라간다
  const [openIdx, setOpenIdx] = useState(initialIdx);
  const [idx, setIdx] = useState(initialIdx);
  const lastOpenIdx = useRef(initialIdx);
  useEffect(() => {
    if (visible) {
      setOpenIdx(initialIdx);
      setIdx(initialIdx);
      lastOpenIdx.current = initialIdx;
    }
    // 열릴 때만 정한다(칸 수가 재기 뒤 바뀌어도 사용자가 고른 칸은 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheet = useRef<BottomSheet>(null);
  const live = useRef({visible, onClose});
  live.current = {visible, onClose};
  const guard = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (guard.current) {
        clearTimeout(guard.current);
      }
    },
    [],
  );

  const onChange = useCallback((i: number) => {
    setIdx(i);
    if (i >= 0) {
      lastOpenIdx.current = i;
    }
  }, []);
  // gorhom 이 닫힌 자리까지 갔다(끌어 내리기). 호출부가 visible 을 끄지 않으면 잠시 뒤 마지막 칸으로 되돌린다
  const onSheetClosed = useCallback(() => {
    live.current.onClose();
    if (guard.current) {
      clearTimeout(guard.current);
    }
    guard.current = setTimeout(() => {
      guard.current = null;
      if (live.current.visible) {
        sheet.current?.snapToIndex(lastOpenIdx.current);
      }
    }, CLOSE_GUARD_MS);
  }, []);

  // ── 스크린리더 손잡이 ──
  const multi = snaps.count > 1;
  const onHandleAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const name = e.nativeEvent.actionName;
      if (name === 'activate' && !multi) {
        live.current.onClose();
      } else if ((name === 'increment' || name === 'decrement') && multi) {
        // 조절로는 닫지 않는다(가장 낮은 칸에서 멈춤, 닫기는 X·뒤로)
        const next = Math.max(0, Math.min(last, idx + (name === 'increment' ? 1 : -1)));
        if (next !== idx) {
          sheet.current?.snapToIndex(next);
        }
      }
    },
    [multi, last, idx],
  );
  const handleCtx = useMemo<HandleCtx>(() => ({multi, level: Math.max(0, idx) + 1, max: snaps.count, onAction: onHandleAction}), [multi, idx, snaps.count, onHandleAction]);
  const footerCtx = useMemo<FooterCtx>(() => ({testID, footer, canScroll, more, insetBottom: insets.bottom}), [testID, footer, canScroll, more, insets.bottom]);

  // gorhom 스크롤 처리기가 이 함수를 의존성으로 가지므로 한 번만 만든다(스크롤마다 처리기 재등록 방지, 리뷰)
  const track = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setY(Math.round(e.nativeEvent.contentOffset.y)), []);
  const onScrollLayout = useCallback((e: LayoutChangeEvent) => setView(Math.round(e.nativeEvent.layout.height)), []);
  const onContentSize = useCallback((_w: number, h: number) => setContent(Math.round(h)), []);

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
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <SheetCloseContext.Provider value={onClose}>
          <SheetHandleContext.Provider value={handleCtx}>
            <SheetFooterContext.Provider value={footerCtx}>
              {/* 모달 표시·testID 는 손잡이·스크롤·아래 줄을 모두 감싼 뿌리에 — gorhom 은 셋을 형제로 그려, 하나에만 두면 나머지가 화면 읽기에서 빠진다 */}
              <RNAnimated.View testID={testID} accessibilityViewIsModal style={[styles.root, {opacity}]}>
                <BottomSheet
                  ref={sheet}
                  // 칸 수가 줄어 범위를 벗어날 때만 마지막 칸으로 자른다(그 밖에는 열 때 정한 값 그대로)
                  index={Math.min(openIdx, last)}
                  snapPoints={snaps.points}
                  enableDynamicSizing={snaps.dynamic}
                  maxDynamicContentSize={maxSheet}
                  topInset={insets.top}
                  enablePanDownToClose
                  animateOnMount={false}
                  onChange={onChange}
                  onClose={onSheetClosed}
                  overrideReduceMotion={ReduceMotion.System}
                  backdropComponent={SheetBackdrop}
                  backgroundComponent={SheetBackground}
                  backgroundStyle={styles.panelBg}
                  handleComponent={SheetHandle}
                  footerComponent={SheetFooter}
                  style={styles.shadow}
                  // gorhom 기본은 시트 전체를 'Bottom Sheet' 조절 막대 하나로 읽는다 → 끄고(null 이 gorhom 의 '없음') 안의 제목·선택지를 그대로 읽게
                  accessible={false}
                  accessibilityLabel={null}
                  accessibilityRole={null}>
                  <BottomSheetScrollView
                    testID={`${testID}-scroll`}
                    enableFooterMarginAdjustment
                    onLayout={onScrollLayout}
                    onContentSizeChange={onContentSize}
                    // iOS 튕김을 끈다: 스크롤 맨 위에서 아래로 당기면 내용이 튕기지 않고 시트만 내려가게
                    bounces={false}
                    onScroll={track}
                    // 관성 스크롤이 멈춘 마지막 위치는 onScroll(쓰로틀)로 안 올 수 있다 → 멈출 때도 기록(에뮬레이터 200% 실측)
                    onMomentumScrollEnd={track}
                    onScrollEndDrag={track}
                    contentContainerStyle={styles.body}>
                    <View style={styles.head}>
                      <View ref={titleRef} accessible accessibilityRole="header" style={styles.titleWrap}>
                        <Heading level={2}>{title}</Heading>
                      </View>
                      <Pressable
                        testID="sheet-close"
                        accessibilityRole="button"
                        accessibilityLabel={dismissLabel('close')} // X 는 상태를 바꾸지 않는 닫기뿐(A5·W-09, 호출부가 고르지 않는다)
                        onPress={onClose}
                        style={({pressed}) => [styles.close, pressed ? styles.closePressed : null]}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
                          <Path d="M6 6l12 12M18 6L6 18" stroke={c.action} strokeWidth={3} strokeLinecap="round" fill="none" />
                        </Svg>
                      </Pressable>
                    </View>
                    {sub ? (
                      <Text role="sub" tone="muted">
                        {sub}
                      </Text>
                    ) : null}
                    {children}
                  </BottomSheetScrollView>
                </BottomSheet>
              </RNAnimated.View>
            </SheetFooterContext.Provider>
          </SheetHandleContext.Provider>
        </SheetCloseContext.Provider>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scrim: {...StyleSheet.absoluteFill, backgroundColor: ds.scrim},
  panelBg: {backgroundColor: c.paper, borderTopLeftRadius: ds.radius.sheet, borderTopRightRadius: ds.radius.sheet},
  shadow: {boxShadow: ds.shadow.sheet, borderTopLeftRadius: ds.radius.sheet, borderTopRightRadius: ds.radius.sheet},
  handleRow: {height: SHEET_HANDLE_H, alignItems: 'center', justifyContent: 'center'},
  handleBar: {width: 40, height: 5, borderRadius: 3, backgroundColor: c.line},
  body: {gap: 12, paddingTop: 0, paddingHorizontal: 20, paddingBottom: 28}, // 손잡이 줄(48)이 위 여백을 맡는다. 아래 inset 은 아래 줄 여백(PR #93 L2)
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  titleWrap: {flex: 1},
  close: {
    minWidth: CLOSE_MIN, minHeight: CLOSE_MIN, borderRadius: ds.radius.button, borderWidth: 1.5, borderColor: c.line,
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
  },
  closePressed: {backgroundColor: c.actionSoft},
  bottom: {backgroundColor: c.paper},
  hidden: {opacity: 0},
  footer: {gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16},
});
