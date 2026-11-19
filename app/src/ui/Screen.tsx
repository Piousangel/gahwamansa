import React, {useEffect, useImperativeHandle, useRef, useState} from 'react';
import {AccessibilityInfo, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {color, layout, space} from './tokens';
import {ScreenTitleContext} from './screenTitle';
import {useReportDock} from './toastPlacement';

const FADE_H = 28; // §15: 본문이 넘치면 아래 28 높이 페이드로 "더 있음"
/** 아래 '더 있음' 흐림 높이(첫 화면에 꼭 보여야 할 묶음이 이 밑에 깔리지 않게 빼는 데 쓴다, P1) */
export const SCREEN_FADE_H = FADE_H;
const TITLE_FOCUS_MS = 300; // talkback-spec R2: 화면 진입 300ms 뒤 제목에 접근성 포커스

type Props = {
  children: React.ReactNode;
  /** 상단 고정(제목·뒤로·한 줄 안내). 스크롤되지 않는다. */
  top?: React.ReactNode;
  /** 하단 고정(주 버튼 1 + 보조 최대 1). 본문과 겹치지 않는 형제라 가려질 수 없다. */
  bottom?: React.ReactNode;
  scrollEnabled?: boolean;
  /** 하단 고정 영역 최대 높이 비율(기본 40%). 첫 화면처럼 버튼이 주인공인 화면만 늘린다. */
  dockMaxRatio?: number;
  /** 본문이 남은 높이를 꽉 채운다(스크롤 없는 한 화면 구성, 예: 첫 화면). */
  fill?: boolean;
  /** 공간이 모자란 화면의 마지막 단계(감사 H3 4단계): 본문 묶음 간격 16 → 12 */
  dense?: boolean;
  /** fill 화면이어도 내용이 창보다 크면 스크롤(P1 안전망, 리드 결정 11-19). 맞으면 스크롤이 생기지 않는다 */
  fillScrollable?: boolean;
  /** 첫 포커스를 제목 대신 이 요소로(예: '다시 정하기'로 연 설정의 확인 제목). 시간 차 없이 한 번만 옮겨 순서가 뒤집히지 않는다(AP-11) */
  initialFocusRef?: React.RefObject<unknown>;
  /** 본문 스크롤 연결점(감사 M3): 펼친 확인 패널처럼 새로 나타난 영역을 보이게 한다. top·bottom 은 본문 안 y */
  scrollRef?: React.Ref<ScreenScroll>;
  /** 본문 보이는 높이(스크롤 창, dp)를 알린다 — 첫 화면 안에 꼭 들어가야 할 묶음 높이를 정할 때(감사 H3 P1) */
  onViewport?: (h: number) => void;
  /**
   * '더 있음' 표시(R-19, v4 DsScreen 이 넘긴다): 주면 글자 위에 겹치는 페이드 대신 스크롤 영역 밖(아래)에 이 띠를 둔다.
   * 본문과 Dock 각각 넘치고 아직 끝까지 내리지 않았을 때만 보인다. 없으면 예전 페이드(기존 화면 그대로).
   */
  moreBand?: React.ReactNode;
};

export type ScreenScroll = {
  /** 본문의 [top, bottom] 구간이 보이도록 필요할 때만 스크롤한다(아래가 가려지면 아래 끝을, 위가 가려지면 위 끝을 맞춤) */
  showRange(top: number, bottom: number): void;
};

// 표준 화면 틀(design-system/components/README.md §15): TopSafe → Top(고정) → Body(스크롤, flex 1) → Dock(고정).
// 글자를 크게 하면 Body 만 스크롤되고 Dock 은 그대로 화면 안에 남는다. top·bottom 없이 쓰면 예전처럼 한 겹 스크롤.
export function Screen({children, top, bottom, scrollEnabled = true, dockMaxRatio, fill, dense, fillScrollable, initialFocusRef, scrollRef, onViewport, moreBand}: Props) {
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  // TopSafe 52 이상(§15). 상태바 바로 아래에 붙지 않게 상태바 높이 + 12(QA B6)
  const topPad = Math.max(space.topSafeMin, insets.top + space.md);
  // 토스트 자리(UX U2): 하단 고정 높이를 알린다(없으면 0)
  const [dockH, setDockH] = useState(0);
  useReportDock(bottom ? dockH : 0);

  // 본문이 넘치고 아직 끝까지 내리지 않았으면 아래 페이드(QA B4). 측정값은 ref, 화면은 boolean 이 바뀔 때만 다시 그린다
  const box = useRef({view: 0, content: 0, y: 0});
  const [more, setMore] = useState(false);
  const measure = (next: Partial<typeof box.current>) => {
    const b = (box.current = {...box.current, ...next});
    const m = b.view > 0 && b.content - b.view - b.y > 4;
    setMore(prev => (prev === m ? prev : m));
  };
  const dockBox = useRef({view: 0, content: 0, y: 0});
  const [dockMore, setDockMore] = useState(false);
  const measureDock = (next: Partial<typeof dockBox.current>) => {
    const b = (dockBox.current = {...dockBox.current, ...next});
    const m = b.view > 0 && b.content - b.view - b.y > 4;
    setDockMore(prev => (prev === m ? prev : m));
  };
  const bodyScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useImperativeHandle(
    scrollRef,
    () => ({
      showRange(from: number, to: number) {
        const {view, y} = box.current;
        if (view <= 0) {
          return;
        }
        if (to > y + view) {
          bodyScroll.current?.scrollTo({y: Math.max(0, to - view + space.md), animated: true});
        } else if (from < y) {
          bodyScroll.current?.scrollTo({y: Math.max(0, from - space.md), animated: true});
        }
      },
    }),
    [],
  );
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
    measure({view: layoutMeasurement.height, content: contentSize.height, y: contentOffset.y});
  };

  // 화면 제목에 접근성 포커스(R2): 위 고정 영역 → 본문 순서로 지금 마운트된 첫 머리글. 화면 읽기가 켜져 있을 때만, 화면당 한 번(마운트 때)
  const tops = useRef<unknown[]>([]);
  const bodies = useRef<unknown[]>([]);
  const registerIn = (list: React.RefObject<unknown[]>) => (node: unknown) => {
    list.current.push(node);
    return () => {
      list.current = list.current.filter(n => n !== node);
    };
  };
  const registerTop = useRef(registerIn(tops)).current;
  const registerBody = useRef(registerIn(bodies)).current;
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(on => {
        if (!on || !alive) {
          return;
        }
        t = setTimeout(() => {
          const node = initialFocusRef?.current ?? tops.current[0] ?? bodies.current[0];
          if (node) {
            try {
              AccessibilityInfo.sendAccessibilityEvent(node as never, 'focus'); // 호스트 요소 ref 를 바로 받는 API
            } catch {
              // 포커스는 보조 기능: 실패해도 화면은 그대로
            }
          }
        }, TITLE_FOCUS_MS);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (t) {
        clearTimeout(t);
      }
    };
    // 마운트 때 한 번(ref 객체는 바뀌지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KAV: Android 도 padding. edgeToEdgeEnabled=true 라 adjustResize 로 창이 줄지 않을 수 있다.
  // (창이 실제로 줄면 KAV 가 겹친 높이를 0으로 계산해 두 번 밀리지 않는다.)
  return (
    <ScreenTitleContext.Provider value={registerBody}>
      <KeyboardAvoidingView style={styles.bg} behavior="padding">
        <View testID="screen-top" style={[styles.top, {paddingTop: topPad}]}>
          <ScreenTitleContext.Provider value={registerTop}>{top}</ScreenTitleContext.Provider>
        </View>
        <View style={styles.body}>
          <ScrollView
            ref={bodyScroll}
            testID="screen-body"
            style={styles.body}
            scrollEnabled={fill ? !!fillScrollable : scrollEnabled}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={64}
            onScroll={onScroll}
            onLayout={e => {
              measure({view: e.nativeEvent.layout.height});
              onViewport?.(Math.round(e.nativeEvent.layout.height));
            }}
            onContentSizeChange={(_w, h) => measure({content: h})}
            contentContainerStyle={[styles.bodyPad, dense ? styles.dense : null, fill ? styles.fill : null, bottom ? null : {paddingBottom: space.bottom + insets.bottom}]}>
            {children}
          </ScrollView>
          {/* 재확인 5 L22: fill 이어도 안전망(fillScrollable)으로 넘치면 '더 있음'을 보인다. moreBand(v4 DsScreen)면 스크롤 밖 띠(R-19), 아니면 예전 흐림 */}
          {more && (!fill || fillScrollable) && moreBand ? (
            <View testID="screen-more-band">{moreBand}</View>
          ) : more && (!fill || fillScrollable) ? (
            <View testID="screen-more" pointerEvents="none" style={styles.more} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Svg width="100%" height={FADE_H}>
                <Defs>
                  <LinearGradient id="screenMore" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color.paper} stopOpacity={0} />
                    <Stop offset="1" stopColor={color.paper} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height={FADE_H} fill="url(#screenMore)" />
              </Svg>
            </View>
          ) : null}
        </View>
        {bottom ? (
          // 하단 고정 영역은 화면의 40% 이하. 글자를 키워 넘치면 영역 안에서 스크롤(본문을 덮지 않음).
          <View
            testID="screen-dock"
            onLayout={e => setDockH(Math.round(e.nativeEvent.layout.height))}
            style={[styles.dock, {maxHeight: Math.floor(height * (dockMaxRatio ?? layout.dock.maxHeightRatio))}]}>
            <ScrollView
              bounces={false}
              testID="screen-dock-scroll"
              scrollEventThrottle={64}
              onLayout={moreBand ? e => measureDock({view: e.nativeEvent.layout.height}) : undefined}
              onContentSizeChange={moreBand ? (_w, h) => measureDock({content: h}) : undefined}
              onScroll={moreBand ? e => measureDock({y: e.nativeEvent.contentOffset.y}) : undefined}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.dockPad, {paddingBottom: Math.max(layout.dock.paddingBottomMin, 16 + insets.bottom)}]}>
              {bottom}
            </ScrollView>
            {moreBand && dockMore ? <View testID="screen-dock-more-band">{moreBand}</View> : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenTitleContext.Provider>
  );
}
const styles = StyleSheet.create({
  bg: {flex: 1, backgroundColor: color.paper},
  top: {paddingHorizontal: layout.bodyPadding.x},
  body: {flex: 1, minHeight: 0},
  more: {position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_H},
  fill: {flexGrow: 1, paddingBottom: 8}, // 한 화면 구성은 아래 여백을 줄여 본문 공간을 확보
  dense: {gap: 12},
  bodyPad: {
    paddingTop: layout.bodyPadding.top,
    paddingHorizontal: layout.bodyPadding.x,
    paddingBottom: layout.bodyPadding.bottom,
    gap: layout.bodyPadding.gap,
  },
  dock: {
    backgroundColor: color.paper,
  },
  // 버튼끼리는 BigButton 바깥 여백(위아래 6)으로 12 간격
  dockPad: {paddingTop: layout.dock.paddingTop - 6, paddingHorizontal: layout.dock.x},
});
