// ds Sheet 끌기(오너 C-3, 11-24): 손잡이·내용 끌기, 속도 스냅, 끌어 닫기, 안쪽 스크롤 소유권, 모션 줄이기, 스크린리더 손잡이.
// 계산 자체는 sheetMath.test.ts(몽망이 92ff492 에서 옮김)가 고정하고, 여기서는 Sheet 가 그 계산을 손가락·화면 읽기에 제대로 잇는지 본다.
// PanResponder 는 touchHistory 로 dy·vy 를 계산하므로 같은 모양의 사건을 만들어 panHandlers 를 직접 부른다
// (RNTL fireEvent 는 터치 응답자의 onMoveShouldSetResponder 를 인자 없이 불러 PanResponder 와 맞지 않는다).
import React from 'react';
import {Text as RNText} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {Sheet} from '../src/ui/ds';

const RN = require('react-native');
const opener = {current: null};
const WIN_H = 640;
const SHEET_H = 500;

beforeEach(() => {
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({width: 360, height: WIN_H, scale: 2.75, fontScale: 1});
});
afterEach(() => {
  jest.restoreAllMocks();
  // preset 의 isReduceMotionEnabled 는 jest.fn 이라 spyOn 이 같은 함수를 돌려준다 → 기본(false)으로 직접 되돌린다
  RN.AccessibilityInfo.isReduceMotionEnabled.mockImplementation(() => Promise.resolve(false));
  jest.useRealTimers();
});

/** 모션 줄이기 켜기: 놓은 뒤 바로 그 자리(0ms)라 결과를 곧장 본다 */
async function reduceMotion() {
  RN.AccessibilityInfo.isReduceMotionEnabled.mockImplementation(() => Promise.resolve(true));
}

async function open(props: Partial<React.ComponentProps<typeof Sheet>> = {}, onClose = jest.fn()) {
  render(
    <Sheet visible title="제목" testID="s" onClose={onClose} returnFocusRef={opener} {...props}>
      <RNText>내용</RNText>
    </Sheet>,
  );
  await act(async () => {}); // useReduceMotion 의 Promise
  fireEvent(screen.getByTestId('s'), 'layout', {nativeEvent: {layout: {height: SHEET_H}}});
  return onClose;
}

/**
 * 한 손가락 세로 끌기: dys = 시작점에서의 누적 이동(px), 한 걸음 step ms. 반환 = 캡처 판정(시트가 손가락을 가졌나).
 * end: 'release' = 손을 뗌, 'terminate' = 다른 응답자(Android 네이티브 스크롤 등)에 빼앗김, 'hold' = 쥔 채로 둠
 */
function drag(testID: string, dys: number[], step = 16, end: 'release' | 'terminate' | 'hold' = 'release'): boolean {
  const el = screen.getByTestId(testID);
  let t = 0;
  let prev = 0;
  const ev = (y: number) => {
    t += step;
    const touch = {
      touchActive: true, startPageX: 0, startPageY: 0, startTimeStamp: 0,
      currentPageX: 0, currentPageY: y, currentTimeStamp: t, previousPageX: 0, previousPageY: prev, previousTimeStamp: t - step,
    };
    prev = y;
    return {nativeEvent: {touches: [], changedTouches: [], pageX: 0, pageY: y, timestamp: t}, touchHistory: {numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t, touchBank: [touch]}};
  };
  const [first, ...rest] = dys;
  const e0 = ev(first);
  const took = !!el.props.onMoveShouldSetResponderCapture(e0);
  if (!took) {
    return false;
  }
  act(() => {
    el.props.onResponderGrant(e0);
    let last = e0;
    for (const y of rest) {
      last = ev(y);
      el.props.onResponderMove(last);
    }
    if (end === 'release') {
      el.props.onResponderRelease(last);
    } else if (end === 'terminate') {
      el.props.onResponderTerminate(last);
    }
  });
  return true;
}

const handle = () => screen.getByTestId('sheet-handle');
/** 지금 그려진 시트 위치(translateY) */
const shownY = () => {
  const st = screen.getByTestId('s-mover').props.style;
  return (Array.isArray(st) ? Object.assign({}, ...st) : st).transform[0].translateY as number;
};
/** 화면 읽기 동작(두 번 누르기 = activate, 위·아래 쓸기 = increment·decrement). 손잡이 props 를 직접 부른다(위 drag 와 같은 이유) */
const a11y = (actionName: string) => act(() => handle().props.onAccessibilityAction({nativeEvent: {actionName}}));

describe('손잡이 끌기', () => {
  test('빠르게 아래로 튕기면 닫힌다(500px/s 이상 = 그 방향 한 칸 = 닫힌 자리)', async () => {
    await reduceMotion();
    const onClose = await open();
    expect(drag('sheet-handle', [6, 30, 60])).toBe(true); // 30px / 16ms ≈ 1875px/s
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('천천히 조금 내렸다 놓으면 제자리로(닫히지 않음)', async () => {
    await reduceMotion();
    const onClose = await open();
    expect(drag('sheet-handle', [6, 40, 60, 80], 200)).toBe(true); // 20px / 200ms = 100px/s, 투영 80 + 20 = 100 → 0 쪽
    expect(onClose).not.toHaveBeenCalled();
  });

  test('천천히라도 절반 넘게 내리면 닫힌다(0.2초 투영이 닫힌 자리에 더 가깝다)', async () => {
    await reduceMotion();
    const onClose = await open();
    drag('sheet-handle', [6, 200, 300, 320], 200);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('가로로 움직인 손가락이나 아주 작은 떨림은 잡지 않는다', async () => {
    await open();
    expect(drag('sheet-handle', [3])).toBe(false);
  });

  test('모션 줄이기가 아니면 남은 거리·놓은 속도에 맞춘 140~280ms 모션으로 자리 잡는다(네이티브 드라이버)', async () => {
    const timing = jest.spyOn(RN.Animated, 'timing');
    await open();
    drag('sheet-handle', [6, 30, 60]);
    expect(timing).toHaveBeenCalledTimes(1);
    const cfg = timing.mock.calls[0][1] as {toValue: number; duration: number; useNativeDriver: boolean};
    expect(cfg.toValue).toBe(SHEET_H);
    expect(cfg.duration).toBeGreaterThanOrEqual(140);
    expect(cfg.duration).toBeLessThanOrEqual(280);
    expect(cfg.useNativeDriver).toBe(true);
  });

  test('모션 줄이기면 모션 없이 바로 그 자리(Animated.timing 을 부르지 않는다)', async () => {
    await reduceMotion();
    const timing = jest.spyOn(RN.Animated, 'timing');
    const onClose = await open();
    drag('sheet-handle', [6, 30, 60]);
    expect(timing).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('끌기 모양', () => {
  test('손잡이를 위로 넘겨 끌면 sqrt 저항으로 조금만 올라간다(손가락 100px → 30px 미만)', async () => {
    await open();
    drag('sheet-handle', [-6, -60, -106], 16, 'hold');
    expect(shownY()).toBeLessThan(0);
    expect(shownY()).toBeGreaterThan(-30);
  });

  test('아래로 끄는 동안 배경이 위치에 따라 옅어진다(맨 위 1 → 닫힌 자리 0)', async () => {
    await open();
    const scrim = () => {
      const st = screen.getByTestId('sheet-scrim-fade', {includeHiddenElements: true}).props.style;
      return (Array.isArray(st) ? Object.assign({}, ...st) : st).opacity as number;
    };
    expect(scrim()).toBe(1);
    drag('sheet-handle', [6, 256], 16, 'hold'); // 위치 250 = 시트 500 의 절반
    expect(scrim()).toBeCloseTo(0.5, 2);
  });

  test('끌어 닫은 뒤 다시 열면 또 끌 수 있다(닫힘 상태가 남지 않는다)', async () => {
    jest.useFakeTimers();
    await reduceMotion();
    const onClose = jest.fn();
    const el = (visible: boolean) => (
      <Sheet visible={visible} title="제목" testID="s" onClose={onClose} returnFocusRef={opener}>
        <RNText>내용</RNText>
      </Sheet>
    );
    await open({}, onClose);
    drag('sheet-handle', [6, 30, 60]);
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.rerender(el(false)); // 부모가 닫음
    act(() => {
      jest.advanceTimersByTime(200);
    });
    screen.rerender(el(true)); // 다시 엶
    fireEvent(screen.getByTestId('s'), 'layout', {nativeEvent: {layout: {height: SHEET_H}}});
    expect(drag('sheet-handle', [6, 30, 60])).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('잘못 닫지 않기(리뷰)', () => {
  test('선택지를 누르다 살짝 튕긴 손가락(24px 미만)은 빨라도 닫지 않는다', async () => {
    await reduceMotion();
    const onClose = await open();
    expect(drag('s-content', [10, 20])).toBe(true); // 10px / 16ms ≈ 625px/s, 움직인 거리 10px
    expect(onClose).not.toHaveBeenCalled();
  });

  test('빼앗긴 손가락(terminate)은 절반 넘게 내렸어도 닫지 않는다(빼앗긴 순간의 위치로 닫기 금지)', async () => {
    await reduceMotion();
    const onClose = await open();
    drag('sheet-handle', [6, 200, 300, 320], 200, 'terminate'); // 놓았다면 닫혔을 위치(위 '절반 넘게' 시험)
    expect(onClose).not.toHaveBeenCalled();
    expect(shownY()).toBe(0);
  });

  test('빼앗긴 손가락은 빼앗긴 순간의 속도를 버린다(빠르게 조금 내리다 빼앗기면 가까운 위 칸으로)', async () => {
    await reduceMotion();
    await open({snapPoints: ['50%', 'content']}); // 위치 [0, 180]
    drag('sheet-handle', [6, 30, 40], 16, 'terminate'); // 위치 34, 속도 625px/s — 놓았다면 아래 칸(180)으로 튕김
    expect(handle().props.accessibilityValue.now).toBe(2);
    expect(shownY()).toBe(0);
  });

  test('안쪽 버튼 누르기 보호: 8px 이하 움직임은 내용 끌기로 잡지 않는다', async () => {
    await open();
    expect(drag('s-content', [8])).toBe(false); // 넘으면 잡는 쪽은 '스크롤할 게 없는 내용은 … 시트가 받는다'(10px)가 본다
  });

  test('호출부가 닫기를 막으면(visible 그대로) 잠시 뒤 시트가 제자리로 돌아와 다시 끌 수 있다', async () => {
    jest.useFakeTimers();
    await reduceMotion();
    const onClose = await open(); // onClose 가 visible 을 끄지 않는다
    drag('sheet-handle', [6, 30, 60]);
    expect(onClose).toHaveBeenCalledTimes(1);
    const timing = jest.spyOn(RN.Animated, 'timing');
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(timing).not.toHaveBeenCalled(); // 모션 줄이기라 바로 제자리
    expect(drag('sheet-handle', [6, 30, 60])).toBe(true); // 닫히는 중으로 묶여 있지 않다
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('여러 칸(snapPoints)', () => {
  const snaps = ['50%', 'content'] as const; // 화면 640 → 320, 시트 500 → 위치 [0, 180]

  test('여러 칸이면 손잡이 두 번 누르기(activate)로 닫지 않는다(조절 막대 — 닫기는 X·뒤로)', async () => {
    const onClose = await open({snapPoints: snaps});
    a11y('activate');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('손잡이는 조절 막대: 값(2단계 중 2단계), 위아래 쓸기로 한 칸씩, 끝에서 멈춤', async () => {
    await reduceMotion();
    await open({snapPoints: snaps});
    expect(handle().props.accessibilityRole).toBe('adjustable');
    expect(handle().props.accessibilityValue).toEqual({min: 1, max: 2, now: 2, text: '2단계 중 2단계'});
    a11y('increment');
    expect(handle().props.accessibilityValue.now).toBe(2);
    a11y('decrement');
    expect(handle().props.accessibilityValue.now).toBe(1);
    a11y('decrement');
    expect(handle().props.accessibilityValue.now).toBe(1); // 조절로는 닫지 않는다(닫기는 X·뒤로)
  });

  test('initialSnap 0 이면 낮은 칸으로 열리고, 낮은 칸에서는 안쪽 스크롤을 꺼 둔다(손가락은 시트 몫)', async () => {
    await open({snapPoints: snaps, initialSnap: 0});
    expect(handle().props.accessibilityValue.now).toBe(1);
    expect(screen.getByTestId('s-scroll').props.scrollEnabled).toBe(false);
  });

  test('다른 칸으로 자리 잡는 모션이 칸 번호가 바뀐 다시 그리기에 끊기지 않는다(순간 이동 없음)', async () => {
    await open({snapPoints: snaps});
    const timing = jest.spyOn(RN.Animated, 'timing');
    const stop = jest.spyOn(RN.Animated.Value.prototype, 'stopAnimation');
    drag('sheet-handle', [6, 150, 160], 200); // 위치 160, 느림 → 180(낮은 칸)으로 모션
    expect(timing.mock.calls.map(c => (c[1] as {toValue: number}).toValue)).toEqual([180]);
    expect(handle().props.accessibilityValue.now).toBe(1);
    expect(stop).toHaveBeenCalledTimes(1); // 잡을 때 한 번뿐 — 놓은 뒤 배치 효과가 모션을 멈추고 180으로 건너뛰지 않는다
  });

  test('느리게 중간쯤 놓으면 가까운 칸, 위로 튕기면 위 칸', async () => {
    await reduceMotion();
    const onClose = await open({snapPoints: snaps});
    drag('sheet-handle', [6, 150, 160], 200); // 위치 160, 느림 → 180(낮은 칸)
    expect(handle().props.accessibilityValue.now).toBe(1);
    drag('sheet-handle', [-6, -30, -60]); // 위로 튕김 → 0(높은 칸)
    expect(handle().props.accessibilityValue.now).toBe(2);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('안쪽 내용 끌기와 스크롤', () => {
  async function scrollable(scrollY: number) {
    await reduceMotion();
    const onClose = await open();
    const scroll = screen.getByTestId('s-scroll');
    fireEvent(scroll, 'layout', {nativeEvent: {layout: {height: 300}}});
    fireEvent(scroll, 'contentSizeChange', 360, 900);
    fireEvent.scroll(scroll, {nativeEvent: {contentOffset: {y: scrollY}}});
    return onClose;
  }

  test('스크롤이 맨 위면 아래로 당기는 손가락은 시트를 내린다(빠르게 → 닫힘)', async () => {
    const onClose = await scrollable(0);
    expect(drag('s-content', [10, 40, 70])).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('스크롤이 내려가 있으면 아래로 당겨도 스크롤 몫(시트는 잡지 않는다)', async () => {
    await scrollable(120);
    expect(drag('s-content', [10, 40])).toBe(false);
  });

  test('맨 위 칸에서 위로 미는 손가락은 스크롤 몫', async () => {
    await scrollable(0);
    expect(drag('s-content', [-10, -40])).toBe(false);
  });

  test('스크롤할 게 없는 내용은 손잡이처럼 위아래 모두 시트가 받는다', async () => {
    await reduceMotion();
    await open();
    expect(drag('s-content', [-10, -20], 200)).toBe(true);
  });
});

test('칸이 하나면 손잡이는 화면 읽기에서 닫기 버튼(두 번 누르기 = activate)', async () => {
  const onClose = await open();
  expect(handle().props.accessibilityRole).toBe('button');
  a11y('activate');
  expect(onClose).toHaveBeenCalledTimes(1);
});
