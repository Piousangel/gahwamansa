import React, {useCallback, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useModalFocus} from '../a11y';
import {useReduceMotion} from '../motion';
import {useToastModalGuard} from '../toastPlacement';
import {useFadeIn} from '../useFadeIn';
import {AudienceProvider, useAudience} from './audience';
import {Heading, Text} from './Text';
import {MoreBand} from './MoreBand';
import {ds} from './roles';
import {dismissLabel} from './dismiss';
import {
  IDLE_DRAG,
  OVERDRAG_FACTOR,
  beginDrag,
  detentPositions,
  dragPosition,
  endDrag,
  ownsDrag,
  pickSnap,
  releaseTarget,
  resolveDetents,
  settleDuration,
  shouldClose,
  stepContentDrag,
  stepDetent,
  type DragSource,
  type DragState,
  type SnapPoint,
} from './sheetMath';

const c = ds.color;
/** 시트 높이 상한(화면 높이 비율, 시안 C4_cheer_sheet_ds4) */
export const SHEET_MAX_RATIO = 0.88;
/** 닫기 알약 최소 크기(48×48) */
const CLOSE_MIN = 48;
/** 손잡이 줄 높이 = 최소 누르기 크기 48(닫기 알약과 같은 규칙, Material 3 시트 손잡이도 48dp). 막대는 40×5 */
const HANDLE_H = 48;
/** 놓은 뒤 자리 잡는 시간 상한(ms). 빠르게 튕기면 sheetMath.settleDuration 이 140ms 까지 줄인다 */
const SETTLE_MS = 280;
/** 손가락이 이만큼(px) 세로로 움직여야 끌기로 본다 — 손잡이는 짧게, 내용은 안의 버튼 누르기를 지키려고 조금 길게 */
const HANDLE_SLOP = 4;
const CONTENT_SLOP = 8;
/** 끌어 닫기 최소 거리(px): 이보다 짧게 움직인 손가락은 빨라도 닫지 않는다 — 선택지를 누르다 살짝 튕긴 손가락이 시트를 닫지 않게(리뷰) */
const MIN_CLOSE_DRAG = 24;
/** onClose 뒤 부모가 이 시간(ms) 안에 visible 을 끄지 않으면(닫기를 막은 호출부) 시트를 제자리로 되돌린다 — 보이지 않는 Modal 이 화면을 막지 않게(리뷰) */
const CLOSE_GUARD_MS = 120;
/** 위로 과도 당김(sqrt 저항)으로 들린 만큼 바닥 틈을 시트 색으로 채우는 치마 높이. 저항 때문에 실제 틈은 수십 px 안 */
const SKIRT_H = 160;

/** 손잡이의 스크린리더 말(컴포넌트 계약의 고정 말 — ui 는 copy 를 모른다, ARCHITECTURE 2절·dismiss.ts 와 같은 방식) */
export const SHEET_HANDLE_TEXT = {
  label: '시트 손잡이',
  /** 멈출 칸이 하나: 두 번 누르기 = 닫기 */
  hintClose: '두 번 누르면 닫혀요',
  /** 멈출 칸이 여럿: 위아래로 쓸어 크기 조절(닫기는 X·뒤로 가기) */
  hintAdjust: '위아래로 쓸어 크기를 바꿔요',
  level: (now: number, max: number) => `${max}단계 중 ${now}단계`,
} as const;

export type {SnapPoint};

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
   * 시트 높이(내용, 상한 88%)를 넘는 값은 시트 높이로 자른다(sheetMath.resolveDetents).
   */
  snapPoints?: readonly SnapPoint[];
  /**
   * 처음 열 칸(낮은 것부터 0). 기본 가장 높은 칸.
   * 낮은 칸은 시트 전체를 아래로 내린 모양이라 footer·내용 아랫부분이 화면 밖에 있고 그동안 안쪽 스크롤은 꺼진다.
   * footer(주 버튼)가 있는 시트에 낮은 칸을 쓰지 않는다(지금 사용처는 모두 기본 한 칸, 리뷰).
   */
  initialSnap?: number;
  testID?: string;
};

const DEFAULT_SNAPS: readonly SnapPoint[] = ['content'];

/**
 * v4 아래 시트(시안 child/C4_cheer_sheet_ds4, UX 깊이 V14). 자녀 전용(어르신은 Dialog).
 * - 머리: 손잡이 막대 + 제목(Heading 2) + 닫기 48×48 알약.
 * - 끌기(오너 C-3, 11-24 — V14 ① '끌어서 닫기 없음'을 바꿈): 손잡이와 내용을 손가락으로 끌어 올리고 내린다. 놓으면 속도로
 *   스냅(느리면 0.2초 투영에 가장 가까운 칸, 500px/s 이상 튕기면 그 방향 한 칸), 닫힌 자리로 가면 onClose. 위로 넘치면 sqrt 저항.
 *   계산은 sheetMath(몽망이 DS-2 68863b8 에서 옮김), 움직임은 RN 기본 Animated + PanResponder(새 네이티브 설치 없음).
 * - 안쪽 스크롤 소유권(gorhom 과 같은 규칙, sheetMath.stepContentDrag): 맨 위 칸이 아니면 시트가 손가락을 가진다(그동안 스크롤은 꺼 둔다),
 *   맨 위 칸에서는 스크롤이 맨 위일 때 아래로 당기는 손가락만 시트 몫.
 * - 높이는 화면의 88%까지, 넘치면 시트 안에서만 스크롤 + 아래 '더 있음' 띠(R-19, 넘칠 때만).
 * - 글자는 역할 상한(선택지 bodyLg 2.0) — 150%로 묶지 않는다(V14 ③).
 * - 닫는 길: X · 밖 누르기 · 안드로이드 뒤로 · 끌어 내리기 · 스크린리더로 손잡이 두 번 누르기(칸이 하나일 때).
 *   칸이 여럿이면 손잡이는 조절 막대(위아래로 쓸기 = 한 칸씩).
 * - 열리면 포커스가 제목으로, 닫히면 연 버튼으로. 여닫는 모션은 불투명도만(옛 BottomSheet 와 같음), 손가락을 따르는 이동만 위치가 바뀐다.
 *   모션 줄이기면 놓은 뒤 바로 그 자리(0ms).
 * - 입력 없는 시트 전용: 자판 처리(KAV)가 없다. 입력이 든 시트(호칭 직접 쓰기 등)를 옮길 때 더한다(PR #93 L3).
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
  const reduce = useReduceMotion();
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const [y, setY] = useState(0);
  // 넘칠 때만, 끝까지 내리면 숨긴다(옛 Screen measure 와 같은 식, PR #93 L1)
  const more = content > view + 1 && y + view < content - 2;
  const canScroll = content > view + 1;

  // ── 위치(sheetMath 좌표: translateY, 0 = 가장 높은 칸) ──
  const [sheetH, setSheetH] = useState(0);
  /** 지금 칸(위쪽부터 번호). -1 = 사용자가 아직 고르지 않음 → initialSnap */
  const [snapIdx, setSnapIdx] = useState(-1);
  const snapKey = JSON.stringify(snapPoints); // 인라인 배열을 넘겨도 그릴 때마다 다시 스냅하지 않게 값으로 비교(몽망이 리뷰 M5)
  const geo = useMemo(() => {
    const positions = detentPositions(resolveDetents(JSON.parse(snapKey) as SnapPoint[], height, sheetH), sheetH);
    return {positions, top: positions[0] ?? 0, lowest: positions[positions.length - 1] ?? 0, closed: sheetH};
  }, [snapKey, height, sheetH]);
  const multi = geo.positions.length > 1;
  const last = geo.positions.length - 1;
  const initialIdx = last - Math.max(0, Math.min(last, initialSnap ?? last));
  const curIdx = snapIdx >= 0 ? Math.min(last, snapIdx) : initialIdx;

  const pos = useRef(new Animated.Value(0)).current;
  const posNow = useRef(0);
  /** 자리 잡는 모션이 가는 곳(없으면 null). settle 이 칸 번호를 바꿔 아래 배치 효과가 다시 돌 때 모션을 끊고 순간 이동하지 않게 */
  const heading = useRef<number | null>(null);
  const guard = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (guard.current) {
        clearTimeout(guard.current);
      }
    },
    [],
  );
  useEffect(() => {
    const id = pos.addListener(({value}) => {
      posNow.current = value;
    });
    return () => pos.removeListener(id);
  }, [pos]);
  const place = useCallback(
    (v: number) => {
      pos.stopAnimation();
      heading.current = null;
      posNow.current = v;
      pos.setValue(v);
    },
    [pos],
  );

  // 손가락·스크롤·닫힘 상태는 PanResponder(한 번 만듦)가 읽으므로 ref 로 비춘다
  const drag = useRef<DragState>(IDLE_DRAG);
  const closing = useRef(false);
  const live = useRef({visible, geo, canScroll, curIdx, reduce, onClose});
  live.current = {visible, geo, canScroll, curIdx, reduce, onClose};
  const scrollY = useRef(0);
  const isOpen = () => live.current.visible && !closing.current;

  // 열릴 때·높이가 바뀔 때 지금 칸으로(손가락이 쥔 동안은 되감지 않는다 — 놓을 때 새 높이로 계산)
  useEffect(() => {
    if (!visible) {
      drag.current = IDLE_DRAG;
      closing.current = false;
      setSnapIdx(-1);
      return;
    }
    if (sheetH <= 0 || drag.current.owner !== null || closing.current) {
      return;
    }
    const target = geo.positions[curIdx] ?? 0;
    if (heading.current !== null && Math.abs(heading.current - target) < 0.5) {
      return; // 이미 그 칸으로 가는 중(settle 직후의 다시 그리기)
    }
    place(target);
  }, [visible, sheetH, geo, curIdx, place]);

  const settle = useCallback(
    function settleTo(target: number, velocity: number) {
      const {geo: g, reduce: rm} = live.current;
      const willClose = shouldClose(target, g.closed);
      if (willClose) {
        closing.current = true;
      } else {
        const k = g.positions.findIndex(x => Math.abs(x - target) < 0.5);
        if (k >= 0) {
          setSnapIdx(k);
        }
      }
      const done = () => {
        if (!willClose) {
          return;
        }
        live.current.onClose();
        guard.current = setTimeout(() => {
          guard.current = null;
          if (live.current.visible && closing.current) {
            closing.current = false; // 호출부가 닫기를 막았다 → 지금 칸으로 되돌린다
            settleTo(live.current.geo.positions[live.current.curIdx] ?? 0, 0);
          }
        }, CLOSE_GUARD_MS);
      };
      const d = settleDuration(target - posNow.current, velocity, rm, SETTLE_MS);
      if (d === 0) {
        place(target);
        done();
        return;
      }
      heading.current = target;
      Animated.timing(pos, {toValue: target, duration: d, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start(({finished}) => {
        if (heading.current === target) {
          heading.current = null;
        }
        if (finished) {
          done();
        } else if (willClose) {
          closing.current = false; // 닫히는 길에 다시 잡혔으면(드물다) 닫지 않고 손가락에 맡긴다
        }
      });
    },
    [pos, place],
  );

  const pans = useMemo(() => {
    const begin = (source: DragSource) => {
      const next = beginDrag(drag.current, source, isOpen(), posNow.current);
      if (next !== null) {
        drag.current = next;
        heading.current = null;
        // 네이티브 드라이버 모션 중이면 리스너 값이 한두 프레임 늦다 → 멈춘 실제 위치로 시작점을 고친다(리뷰)
        pos.stopAnimation(v => {
          posNow.current = v;
          if (drag.current.owner === source && !drag.current.moved) {
            drag.current = {...drag.current, start: v, raw: v};
          }
        });
      }
    };
    const move = (source: DragSource, gs: PanResponderGestureState) => {
      if (!ownsDrag(drag.current, source, isOpen())) {
        return;
      }
      const {geo: g, canScroll: scrollable} = live.current;
      const raw = drag.current.start + gs.dy;
      drag.current = {...drag.current, raw, moved: true};
      // 내용 끌기에서 스크롤할 게 있으면 맨 위 칸에서 멈춘다(그 위는 스크롤 몫). 손잡이와 스크롤 없는 내용은 위로 sqrt 저항
      const overTop = source === 'handle' || !scrollable;
      posNow.current = dragPosition({raw, top: g.top, bottom: g.closed, overTop, overBottom: false, factor: OVERDRAG_FACTOR});
      pos.setValue(posNow.current);
    };
    const release = (source: DragSource, gs: PanResponderGestureState, interrupted = false) => {
      const g = live.current.geo;
      // 다른 응답자(Android 네이티브 스크롤 등)에 빼앗긴 손가락은 속도 없이 가까운 열린 칸으로만 — 빼앗긴 순간의 속도로 닫지 않는다
      const v = interrupted ? 0 : gs.vy * 1000; // PanResponder 는 px/ms, sheetMath 는 px/s
      const canClose = !interrupted && posNow.current - drag.current.start >= MIN_CLOSE_DRAG;
      const target = releaseTarget(drag.current, source, isOpen(), posNow.current, v, g.positions, canClose ? g.closed : null);
      drag.current = endDrag(drag.current, source);
      if (target !== null) {
        settle(target, v);
      } else if (isOpen() && !g.positions.some(x => Math.abs(x - posNow.current) < 0.5)) {
        settle(pickSnap(posNow.current, 0, g.positions, null), 0); // 자리 잡던 중 잡았다 그냥 놓으면 가까운 칸으로
      }
    };
    const vertical = (gs: PanResponderGestureState, slop: number) => Math.abs(gs.dy) > slop && Math.abs(gs.dy) > Math.abs(gs.dx);
    const make = (source: DragSource, want: (gs: PanResponderGestureState) => boolean) =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, gs) => isOpen() && want(gs),
        onPanResponderGrant: () => begin(source),
        onPanResponderMove: (_e, gs) => move(source, gs),
        onPanResponderRelease: (_e, gs) => release(source, gs),
        onPanResponderTerminate: (_e, gs) => release(source, gs, true),
        onPanResponderTerminationRequest: () => false,
      });
    return {
      handle: make('handle', gs => vertical(gs, HANDLE_SLOP)),
      // 내용: 이 손가락을 시트가 가질지 스크롤이 가질지는 stepContentDrag 가 정한다(맨 위 칸이 아니면 시트, 맨 위 칸이면 스크롤 맨 위에서 아래로만)
      content: make('content', gs => {
        if (!vertical(gs, CONTENT_SLOP)) {
          return false;
        }
        const {geo: g, canScroll: scrollable} = live.current;
        return stepContentDrag({pos: posNow.current, delta: gs.dy, scrollY: scrollY.current, top: g.top, bottom: g.closed, scrollable}).sheetOwns;
      }),
    };
    // 한 번 만들고 최신 값은 live·drag ref 로 읽는다
  }, [pos, settle]);

  // ── 스크린리더: 칸이 하나면 손잡이 = 닫기 버튼, 여럿이면 조절 막대(한 칸씩, 닫기는 X·뒤로) ──
  const level = last - curIdx + 1; // 낮은 칸부터 1
  const onHandleAction = (e: AccessibilityActionEvent) => {
    if (!isOpen()) {
      return;
    }
    const name = e.nativeEvent.actionName;
    if (name === 'activate' && !multi) {
      onClose();
    } else if ((name === 'increment' || name === 'decrement') && multi) {
      settle(stepDetent(posNow.current, geo.positions, name === 'increment' ? 'up' : 'down'), 0);
    }
  };
  const handleA11y = multi
    ? {
        accessibilityRole: 'adjustable' as const,
        accessibilityHint: SHEET_HANDLE_TEXT.hintAdjust,
        accessibilityValue: {min: 1, max: last + 1, now: level, text: SHEET_HANDLE_TEXT.level(level, last + 1)},
        accessibilityActions: [{name: 'increment' as const}, {name: 'decrement' as const}],
      }
    : {
        accessibilityRole: 'button' as const,
        accessibilityHint: SHEET_HANDLE_TEXT.hintClose,
        accessibilityActions: [{name: 'activate' as const}],
      };

  // 배경 진하기: 가장 낮은 칸까지 1, 닫힌 자리에서 0(sheetMath.backdropProgress 와 같은 식, 애니메이션 보간으로)
  // 스크롤마다 다시 그려도 보간 노드를 새로 만들지 않게 묶는다(리뷰)
  const scrimOpacity = useMemo(
    () => (geo.closed - geo.lowest >= 1 ? pos.interpolate({inputRange: [geo.lowest, geo.closed], outputRange: [1, 0], extrapolate: 'clamp'}) : 1),
    [pos, geo.lowest, geo.closed],
  );
  const track = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    setY(Math.round(e.nativeEvent.contentOffset.y));
  };

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
      <Animated.View style={[styles.root, {opacity}]}>
        {/* 밖 누르기 = 닫기. 화면 읽기에서는 X 가 같은 일을 하므로 숨긴다 */}
        <Animated.View style={[StyleSheet.absoluteFill, {opacity: scrimOpacity}]}>
          <Pressable testID="sheet-scrim" style={styles.scrim} onPress={onClose} accessible={false} importantForAccessibility="no" />
        </Animated.View>
        <Animated.View testID={`${testID}-mover`} style={{transform: [{translateY: pos}]}}>
          {/* 아래 inset(3버튼 내비·홈 인디케이터)은 패널 바닥 여백으로 — 스크롤 내용과 더 있음 띠가 모두 그 위에 놓인다(PR #93 L2) */}
          <View
            testID={testID}
            accessibilityViewIsModal
            onLayout={e => setSheetH(Math.round(e.nativeEvent.layout.height))}
            style={[styles.panel, {maxHeight: Math.floor(height * SHEET_MAX_RATIO), paddingBottom: insets.bottom}]}>
            <View
              testID="sheet-handle"
              accessible
              accessibilityLabel={SHEET_HANDLE_TEXT.label}
              {...handleA11y}
              onAccessibilityAction={onHandleAction}
              style={styles.handleRow}
              {...pans.handle.panHandlers}>
              <View style={styles.handleBar} />
            </View>
            <View testID={`${testID}-content`} style={styles.contentWrap} {...pans.content.panHandlers}>
              <ScrollView
                testID={`${testID}-scroll`}
                style={styles.scroll}
                // 맨 위 칸이 아니면 손가락은 시트 몫 — 스크롤을 꺼 두어 Android 네이티브 스크롤이 끌기를 가로채지 않게
                scrollEnabled={curIdx === 0}
                onLayout={e => setView(Math.round(e.nativeEvent.layout.height))}
                onContentSizeChange={(_w, h) => setContent(Math.round(h))}
                // iOS 튕김을 끈다: 스크롤 맨 위에서 아래로 당기면 내용이 튕기지 않고 시트만 내려가게(리뷰)
                bounces={false}
                onScroll={track}
                // 관성 스크롤이 멈춘 마지막 위치는 onScroll(쓰로틀)로 안 올 수 있다 → 멈출 때도 기록(에뮬레이터 200% 실측)
                onMomentumScrollEnd={track}
                onScrollEndDrag={track}
                scrollEventThrottle={16}
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
              </ScrollView>
            </View>
            {more ? <MoreBand /> : null}
            {footer ? (
              <View testID={`${testID}-footer`} style={styles.footer}>
                {footer}
              </View>
            ) : null}
          </View>
          {/* 위로 과도 당김으로 들린 만큼 바닥 틈을 시트 색으로 채운다(gorhom·몽망이와 같은 방식). 평소에는 화면 밖 */}
          <View style={styles.skirt} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  scrim: {...StyleSheet.absoluteFill, backgroundColor: ds.scrim},
  panel: {backgroundColor: c.paper, borderTopLeftRadius: ds.radius.sheet, borderTopRightRadius: ds.radius.sheet, boxShadow: ds.shadow.sheet, overflow: 'hidden'},
  handleRow: {height: HANDLE_H, alignItems: 'center', justifyContent: 'center'},
  handleBar: {width: 40, height: 5, borderRadius: 3, backgroundColor: c.line},
  contentWrap: {flexShrink: 1},
  scroll: {flexGrow: 0},
  body: {gap: 12, paddingTop: 0, paddingHorizontal: 20, paddingBottom: 28}, // 손잡이 줄(48)이 위 여백을 맡는다. 아래 inset 은 패널 바닥 여백(PR #93 L2)
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  titleWrap: {flex: 1},
  close: {
    minWidth: CLOSE_MIN, minHeight: CLOSE_MIN, borderRadius: ds.radius.button, borderWidth: 1.5, borderColor: c.line,
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
  },
  closePressed: {backgroundColor: c.actionSoft},
  footer: {gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16},
  skirt: {position: 'absolute', left: 0, right: 0, top: '100%', height: SKIRT_H, backgroundColor: c.paper},
});
