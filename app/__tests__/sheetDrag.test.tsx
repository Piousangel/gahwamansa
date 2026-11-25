// ds Sheet 끌기 계약(오너 C-3·O-3, 11-25 gorhom 이전). 손가락 끌기·스냅 모션·안쪽 스크롤 동시 인식은 gorhom(UI 스레드)이 하므로
// jest 는 우리 Sheet 가 gorhom 에 넘기는 설정과 gorhom 이 돌려주는 사건(onChange·onClose)을 제대로 잇는지 본다.
// 실제 끌기(200% 넘치는 시트 내용 끌어 닫기 포함)는 에뮬레이터 증거: docs/team/qa/evidence/2026-11-25-gorhom/
// gorhom 목: testUtils/gorhomMock.js(공식 목 + 손잡이·배경·밖 누르기 그리기, __last 로 props·ref 호출 확인)
import React from 'react';
import {StyleSheet, Text as RNText} from 'react-native';
import {act, fireEvent, render, renderHook, screen} from '@testing-library/react-native';
import {getAnimatedStyle as getAnimatedStyleUntyped, ReduceMotion} from 'react-native-reanimated';
import {Sheet, SHEET_HANDLE_H} from '../src/ui/ds';
import {CONTENT_MIN_DRAG, limitShortContentFling, resolveSnapPoints, useSheetGestureHandlers} from '../src/ui/ds/Sheet';

const RN = require('react-native');
// Reanimated 4.8 의 기본 타입은 웹 대역(인자 없음)이라 jest(네이티브 판) 서명으로 맞춘다. 같은 이유로 toHaveAnimatedStyle 매처도 tsc 가 모른다(리뷰)
const getAnimatedStyle = getAnimatedStyleUntyped as unknown as (el: unknown) => Record<string, unknown>;
const gorhom = require('@gorhom/bottom-sheet');
const opener = {current: null};
const WIN_H = 640;

beforeEach(() => {
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: WIN_H, scale: 2.75, fontScale: 1});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

type Props = Partial<React.ComponentProps<typeof Sheet>>;
const el = (props: Props, onClose: () => void) => (
  <Sheet visible title="제목" testID="s" onClose={onClose} returnFocusRef={opener} {...props}>
    <RNText>내용</RNText>
  </Sheet>
);
function open(props: Props = {}, onClose = jest.fn()) {
  render(el(props, onClose));
  return onClose;
}
const last = () => gorhom.__last() as {props: Record<string, any>; api: Record<string, jest.Mock>; index: number};
const handle = () => screen.getByTestId('sheet-handle');
const a11y = (actionName: string) => act(() => handle().props.onAccessibilityAction({nativeEvent: {actionName}}));
/** 몸통(손잡이 아래)을 잰다 → 시트 높이 = 몸통 + 손잡이 48 */
const measure = (sheetH: number) => fireEvent(screen.getByTestId('s-scroll'), 'contentSizeChange', 360, sheetH - SHEET_HANDLE_H);

describe('gorhom 설정', () => {
  test('기본(칸 하나 = 내용 높이): 동적 높이, 끌어 닫기 켬, 88% 상한, 모션 줄이기는 시스템 설정을 따름', () => {
    open();
    const p = last().props;
    expect(p.enableDynamicSizing).toBe(true);
    expect(p.snapPoints).toEqual([]);
    expect(p.index).toBe(0);
    expect(p.enablePanDownToClose).toBe(true);
    expect(p.maxDynamicContentSize).toBe(Math.floor(WIN_H * 0.88));
    expect(p.overrideReduceMotion).toBe(ReduceMotion.System);
    // 여는 모션은 불투명도만(공용 모션 규칙 §0-6) — gorhom 아래에서 올라오기는 끈다
    expect(p.animateOnMount).toBe(false);
    // 스크롤 밖 아래 줄(더 있음 띠·footer·아래 inset)은 gorhom footerComponent 로, 스크롤 아래 여백을 gorhom 이 맞춘다
    expect(p.footerComponent).toBeTruthy();
    expect(screen.UNSAFE_getByType(gorhom.BottomSheetScrollView).props.enableFooterMarginAdjustment).toBe(true);
  });

  test('스크롤은 시트의 바로 아래 자식(BottomSheetView 로 감싸지 않음) — 감싸면 gorhom 이 내용을 "스크롤 없음"으로 덮어써 넘치는 시트에서 스크롤 대신 시트가 들린다', () => {
    open();
    const scroll = screen.UNSAFE_getByType(gorhom.BottomSheetScrollView);
    // 목의 BottomSheet 는 자식을 'gorhom-sheet' View 바로 안에 그린다(BottomSheetView 목이 끼면 그 컴포넌트가 부모가 된다)
    expect(scroll.parent?.props.testID).toBe('gorhom-sheet');
  });

  test('스크린리더: gorhom 기본(시트 전체 = "Bottom Sheet" 조절 막대 하나)을 끄고, 바탕도 읽지 않는다', () => {
    open();
    expect(last().props.accessible).toBe(false);
    // gorhom 은 null 을 '없음'으로 받는다(undefined 면 기본값 'Bottom Sheet'·adjustable 이 Android 에 남는다, 리뷰)
    expect(last().props.accessibilityLabel).toBeNull();
    expect(last().props.accessibilityRole).toBeNull();
    expect(last().props.backgroundComponent).toBeTruthy(); // 기본 바탕(accessible adjustable)을 쓰지 않는다
    expect(screen.queryByLabelText('Bottom Sheet')).toBeNull();
    // 제목·닫기는 따로 읽힌다(시트 하나로 묶이지 않음)
    expect(screen.getAllByRole('header').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', {name: '닫기'})).toBeTruthy();
  });

  test('손잡이 줄은 48 높이(최소 누르기 크기), 손잡이는 gorhom handleComponent 로 그려진다', () => {
    open();
    expect(StyleSheet.flatten(handle().props.style).height).toBe(48);
    expect(last().props.handleComponent).toBeTruthy();
  });
});

describe('끌어 닫기(gorhom onClose)', () => {
  test('끌어 내려 닫힌 자리에 가면 onClose 한 번', () => {
    const onClose = open();
    act(() => last().props.onClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('호출부가 닫기를 막으면(visible 그대로) 잠시 뒤 마지막 칸으로 되돌린다 — 보이지 않는 Modal 이 화면을 막지 않게', () => {
    jest.useFakeTimers();
    const onClose = open({snapPoints: ['50%', 'content']});
    measure(500);
    act(() => last().props.onChange(0)); // 사용자가 낮은 칸으로 내렸다
    act(() => last().props.onClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(last().api.snapToIndex).toHaveBeenCalledWith(0);
  });

  test('부모가 닫으면(visible false) 되돌리지 않는다', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    open({}, onClose);
    const api = last().api;
    act(() => last().props.onClose());
    screen.rerender(el({visible: false}, onClose));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(api.snapToIndex).not.toHaveBeenCalled();
  });

  test('부모가 닫고 120ms 안에 다시 열어도 기다리던 되돌리기가 새 시트를 움직이지 않는다(닫히면 가드를 버림, QA-2 L2)', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    open({}, onClose);
    act(() => last().props.onClose());
    screen.rerender(el({visible: false}, onClose));
    screen.rerender(el({visible: true}, onClose)); // 곧바로 다시 엶
    const api = last().api;
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(api.snapToIndex).not.toHaveBeenCalled();
  });

  test('끌어 닫은 뒤 다시 열면 처음 칸으로 다시 연다(닫힘 상태가 남지 않는다)', () => {
    const onClose = jest.fn();
    open({snapPoints: ['50%', 'content']}, onClose);
    measure(500);
    act(() => last().props.onChange(-1));
    act(() => last().props.onClose());
    screen.rerender(el({visible: false, snapPoints: ['50%', 'content']}, onClose));
    screen.rerender(el({visible: true, snapPoints: ['50%', 'content']}, onClose));
    expect(last().props.index).toBe(1);
    expect(handle().props.accessibilityValue.now).toBe(2);
  });
});

describe('밖 누르기 배경', () => {
  test('누르면 onClose, 화면 읽기에서는 숨김(X 가 같은 일)', () => {
    const onClose = open();
    const scrim = screen.getByTestId('sheet-scrim', {includeHiddenElements: true});
    expect(scrim.props.importantForAccessibility).toBe('no');
    fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('진하기는 gorhom 칸 번호를 따른다: 열린 칸 1, 닫힌 자리(-1) 0', () => {
    jest.useFakeTimers(); // Reanimated jest 는 공유 값 바뀜을 다음 프레임(가짜 시계)에 스타일로 옮긴다
    open();
    const fade = () => screen.getByTestId('sheet-scrim-fade', {includeHiddenElements: true});
    expect(getAnimatedStyle(fade())).toMatchObject({opacity: 1});
    act(() => last().api.close());
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(getAnimatedStyle(fade())).toMatchObject({opacity: 0});
  });
});

describe('여러 칸(snapPoints)', () => {
  const snaps = ['50%', 'content'] as const; // 화면 640 → 320, 시트 500

  test('우리 칸 → gorhom 칸: 내용 칸은 동적 높이, 나머지는 px(시트 높이로 자름), 낮은 것부터', () => {
    open({snapPoints: snaps});
    measure(500);
    expect(last().props.snapPoints).toEqual([320]);
    expect(last().props.enableDynamicSizing).toBe(true);
    expect(last().props.index).toBe(1); // 기본 = 가장 높은 칸
  });

  test('손잡이는 조절 막대: 값(2단계 중 2단계), 위아래 쓸기로 한 칸씩, 가장 낮은 칸에서 멈춤(조절로는 닫지 않음)', () => {
    const onClose = open({snapPoints: snaps});
    measure(500);
    expect(handle().props.accessibilityRole).toBe('adjustable');
    expect(handle().props.accessibilityValue).toEqual({min: 1, max: 2, now: 2, text: '2단계 중 2단계'});
    a11y('increment');
    expect(last().api.snapToIndex).not.toHaveBeenCalled(); // 이미 맨 위
    a11y('decrement');
    expect(last().api.snapToIndex).toHaveBeenLastCalledWith(0);
    expect(handle().props.accessibilityValue.now).toBe(1);
    a11y('decrement');
    expect(last().api.snapToIndex).toHaveBeenCalledTimes(1);
    a11y('activate'); // 여러 칸이면 두 번 누르기로 닫지 않는다(닫기는 X·뒤로)
    expect(onClose).not.toHaveBeenCalled();
  });

  test('열려 있는 동안 gorhom index 는 열 때 정한 값(바뀌면 gorhom 이 그 칸으로 강제 스냅, 리뷰) — 칸 수가 줄어 범위를 벗어날 때만 자른다', () => {
    open({snapPoints: [100, '50%', 'content'], initialSnap: 1});
    measure(500);
    expect(last().props.snapPoints).toEqual([100, 320]);
    expect(last().props.index).toBe(1);
    measure(600); // 내용이 길어져도(칸 수 그대로) index 는 그대로
    expect(last().props.index).toBe(1);
    measure(300); // 내용이 짧아 320 칸이 내용 칸과 겹침 → [100, 내용] 2칸 — 1 은 아직 범위 안
    expect(last().props.snapPoints).toEqual([100]);
    expect(last().props.index).toBe(1);
    measure(120); // 100 칸도 겹침 직전 → 그대로 2칸
    measure(60); // 100 칸이 내용 칸보다 높아짐 → 내용 칸 하나 → 0 으로 자름
    expect(last().props.index).toBe(0);
  });

  test('initialSnap 0 이면 낮은 칸으로 연다', () => {
    open({snapPoints: snaps, initialSnap: 0});
    expect(last().props.index).toBe(0);
    expect(handle().props.accessibilityValue.now).toBe(1);
  });

  test('손가락으로 옮긴 칸(gorhom onChange)이 조절 막대 값에 반영된다 — gorhom index 는 그대로(바꾸면 gorhom 이 다시 스냅, QA-2 L1)', () => {
    open({snapPoints: snaps});
    measure(500);
    act(() => last().props.onChange(0));
    expect(handle().props.accessibilityValue.now).toBe(1);
    expect(last().props.index).toBe(1);
  });
});

describe('resolveSnapPoints', () => {
  test('잰 뒤: % → px, 시트 높이를 넘는 칸은 자르고, 내용 칸과 겹치는 칸은 뺀다', () => {
    expect(resolveSnapPoints(['50%', 'content'], 640, 500)).toEqual({points: [320], dynamic: true, count: 2});
    expect(resolveSnapPoints([700, 'content'], 640, 500)).toEqual({points: [], dynamic: true, count: 1});
    expect(resolveSnapPoints([600, 200], 640, 500)).toEqual({points: [200, 500], dynamic: false, count: 2});
    expect(resolveSnapPoints(['content'], 640, 0)).toEqual({points: [], dynamic: true, count: 1});
  });

  test('쓸 칸이 하나도 없으면 내용 칸 하나(gorhom 은 빈 칸 목록에서 멈춘다, 리뷰)', () => {
    expect(resolveSnapPoints([], 640, 500)).toEqual({points: [], dynamic: true, count: 1});
    expect(resolveSnapPoints([0], 640, 500)).toEqual({points: [], dynamic: true, count: 1});
  });

  test('재기 전에는 자르지 않는다', () => {
    expect(resolveSnapPoints(['50%', 'content'], 640, 0)).toEqual({points: [320], dynamic: true, count: 2});
  });
});

test('칸이 하나면 손잡이는 화면 읽기에서 닫기 버튼(두 번 누르기 = activate)', () => {
  const onClose = open();
  // accessible 이 없으면 iOS VoiceOver 가 손잡이를 건너뛰어 '닫기 버튼·조절 막대' 계약이 통째로 사라진다(QA-2 M1)
  expect(handle().props.accessible).toBe(true);
  expect(handle().props.accessibilityRole).toBe('button');
  expect(handle().props.accessibilityHint).toBe('두 번 누르면 닫혀요');
  a11y('activate');
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('화면 읽기 순서(실제 gorhom 과 같은 목): 제목·닫기·내용·아래 줄 → 손잡이가 맨 뒤(QA-2 M2, DECISIONS 기록, S25 TalkBack 확인 목록)', () => {
  open({footer: <RNText testID="foot">저장</RNText>});
  const order = screen.root
    .findAll(n => typeof n.type === 'string' && ['sheet-close', 's-scroll', 's-footer', 'sheet-handle'].includes(n.props.testID))
    .map(n => n.props.testID);
  expect(order).toEqual(['s-scroll', 'sheet-close', 's-footer', 'sheet-handle']);
});

describe('내용 끌기 최소 거리(리드 결정 #255 QA-2 M3, #232 MIN_CLOSE_DRAG 와 같은 뜻)', () => {
  const {GESTURE_SOURCE} = gorhom;
  test('내용에서 24dp 미만으로 끈 손가락은 놓은 속도를 버린다 → gorhom 이 위치만으로 가까운 칸(제자리)을 고른다', () => {
    expect(limitShortContentFling(GESTURE_SOURCE.CONTENT, {translationY: 15, velocityY: 2000})).toEqual({translationY: 15, velocityY: 0});
    expect(limitShortContentFling(GESTURE_SOURCE.CONTENT, {translationY: -15, velocityY: -2000})).toEqual({translationY: -15, velocityY: 0});
  });
  test('24dp 이상 끈 내용, 손잡이 끌기는 그대로(손잡이는 제한 없음)', () => {
    expect(limitShortContentFling(GESTURE_SOURCE.CONTENT, {translationY: CONTENT_MIN_DRAG, velocityY: 2000}).velocityY).toBe(2000);
    expect(limitShortContentFling(GESTURE_SOURCE.HANDLE, {translationY: 5, velocityY: 2000}).velocityY).toBe(2000);
  });
  test('위로 크게(24dp 이상) 튕긴 내용은 속도 유지 — 낮은 칸에서 위 칸으로 올라갈 수 있게(QA-1 재확인 L1)', () => {
    expect(limitShortContentFling(GESTURE_SOURCE.CONTENT, {translationY: -CONTENT_MIN_DRAG, velocityY: -2000}).velocityY).toBe(-2000);
    expect(limitShortContentFling(GESTURE_SOURCE.CONTENT, {translationY: -80, velocityY: -2000}).velocityY).toBe(-2000);
  });
  test('시트는 gorhom 기본 처리기를 감싼 훅을 쓰고, 놓을 때만 위 규칙을 거쳐 기본 처리기에 넘긴다', () => {
    open();
    expect(last().props.gestureEventsHandlersHook).toBe(useSheetGestureHandlers);
    const {result} = renderHook(() => useSheetGestureHandlers());
    const base = gorhom.__defaultHandlers;
    expect(result.current.handleOnStart).toBe(base.handleOnStart);
    result.current.handleOnEnd(GESTURE_SOURCE.CONTENT, {translationY: 15, velocityY: 2000} as never);
    expect(base.handleOnEnd).toHaveBeenLastCalledWith(GESTURE_SOURCE.CONTENT, {translationY: 15, velocityY: 0});
    result.current.handleOnEnd(GESTURE_SOURCE.HANDLE, {translationY: 15, velocityY: 2000} as never);
    expect(base.handleOnEnd).toHaveBeenLastCalledWith(GESTURE_SOURCE.HANDLE, {translationY: 15, velocityY: 2000});
  });
});

test('바탕은 화면 읽기에서 자손까지 숨긴다(gorhom 기본 바탕은 "Bottom Sheet" 조절 막대, QA-2 L3)', () => {
  open();
  const bg = screen.getByTestId('sheet-bg', {includeHiddenElements: true});
  expect(bg.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(bg.props.accessible).toBe(false);
});

test('스크롤 프레임마다 시트를 다시 그리지 않는다 — 띠 표시가 바뀔 때만(QA-2 L4)', () => {
  let renders = 0;
  render(
    <React.Profiler id="sheet" onRender={() => (renders += 1)}>
      <Sheet visible title="제목" testID="s" onClose={jest.fn()} returnFocusRef={opener}>
        <RNText>내용</RNText>
      </Sheet>
    </React.Profiler>,
  );
  const scroll = screen.getByTestId('s-scroll');
  act(() => {
    fireEvent(scroll, 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}});
    fireEvent(scroll, 'contentSizeChange', 360, 900);
  });
  const before = renders;
  const at = (y: number) => act(() => fireEvent.scroll(scroll, {nativeEvent: {contentOffset: {x: 0, y}}}));
  [10, 50, 120, 300].forEach(at); // 아직 끝이 아님 → 띠 그대로
  expect(renders).toBe(before);
  at(600); // 끝 → 띠 숨김(한 번 다시 그림)
  expect(renders).toBeGreaterThan(before);
});

test('안쪽 스크롤은 gorhom 스크롤(BottomSheetScrollView)이라 끌기와 동시에 인식된다', () => {
  // RN ScrollView 를 쓰면 Android 네이티브 스크롤이 손가락을 가져가 넘치는 시트를 내용으로 끌어 닫지 못한다(#232 남은 한계)
  open();
  const scroll = screen.UNSAFE_getByType(gorhom.BottomSheetScrollView);
  expect(scroll.props.testID).toBe('s-scroll');
});
