import React, {useCallback, useEffect, useState} from 'react';
import {View, type LayoutChangeEvent} from 'react-native';

/**
 * 세로 묶음 + 접힘 경계 맞춤(RULES-V4 R-15 '모든 배율에서 접힘 경계는 줄/요소 경계').
 * 본문 스크롤 영역(viewport) 아래 끝에 걸치는 첫 요소를 찾아, 그 요소 앞에 여백을 넣어 통째로 접힘 아래로 민다.
 * 반쯤 잘린 버튼·글줄이 첫 화면에 보이지 않게 하고, 아래 '더 있음' 띠(R-19)가 다음 내용을 알린다.
 * - 계산은 자연 높이(요소 높이 + gap)로만 해서 넣은 여백이 다시 계산을 흔들지 않는다.
 * - 요소가 viewport 보다 크면(넣어도 안 들어감) 밀지 않는다. viewport 를 모르면(0) 아무것도 하지 않는다.
 * - 이 묶음은 스크롤 내용의 직접 자식이어야 한다(top 값 = 스크롤 내용 안 위치). P1 키패드(CodeInput)와 같은 규칙을 일반화.
 */
export function FoldStack({viewport, gap, children, testID, onFold, split, onTop}: {
  viewport: number;
  gap: number;
  children: React.ReactNode;
  testID?: string;
  /** 민 요소의 key(없으면 null). 화면이 순서를 바꿔 더 중요한 요소를 첫 화면에 넣을 때 쓴다(P4 설명 줄) */
  onFold?: (key: string | null) => void;
  /**
   * 통째로 밀지 않는 요소 key(안에서 줄 단위로 스스로 맞춘다: P5 선택지 2장은 카드마다). 이 요소가 걸치면 묶음은 아무것도 밀지 않고,
   * onTop 으로 받은 위치로 요소가 직접 foldPush 를 계산한다
   */
  split?: string;
  onTop?: (top: number) => void;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  const [top, setTop] = useState(0);
  // 높이는 요소 key 로 기억한다(화면이 순서를 바꿔도 다른 요소 높이로 계산하지 않게)
  const ids = items.map((c, i) => keyOf(c) ?? `#${i}`);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const onItem = useCallback((id: string, e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));
  }, []);
  const found = foldPush(viewport, top, ids.map(id => heights[id]), gap);
  const push = found && split && ids[found.index] === split ? null : found;
  const pushedKey = push ? keyOf(items[push.index]) : null;
  // split 요소의 자연 위치(스크롤 내용 안)
  const splitTop = split ? naturalTop(top, ids.map(id => heights[id]), gap, ids.indexOf(split)) : null;
  useEffect(() => {
    if (splitTop != null) {
      onTop?.(splitTop);
    }
  }, [splitTop, onTop]);
  const known = viewport > 0 && ids.every(id => heights[id] !== undefined);
  useEffect(() => {
    if (known) {
      onFold?.(pushedKey);
    }
  }, [known, pushedKey, onFold]);
  return (
    <View testID={testID} onLayout={e => setTop(Math.round(e.nativeEvent.layout.y))}>
      {items.map((child, i) => (
        <View
          key={ids[i]}
          onLayout={e => onItem(ids[i], e)}
          style={{marginTop: (i === 0 ? 0 : gap) + (push && push.index === i ? push.space : 0)}}>
          {child}
        </View>
      ))}
    </View>
  );
}

// Children.toArray 는 key 를 '.$read'·배열 안이면 '.2:$q0' 꼴로 바꾼다 → 마지막 '$' 뒤(화면이 준 key)만 쓴다(PR #91 리뷰)
export const keyOf = (c: React.ReactNode): string | null =>
  React.isValidElement(c) && c.key != null ? String(c.key).replace(/^.*\$/, '') : null;

function naturalTop(top: number, heights: (number | undefined)[], gap: number, index: number): number | null {
  if (index < 0 || heights.slice(0, index).some(h => h === undefined)) {
    return null;
  }
  return heights.slice(0, index).reduce<number>((y, h) => y + (h as number) + gap, top);
}

/**
 * 접힘에 걸치는 첫 요소와 넣을 여백(순수 함수, 테스트용). 높이를 아직 모르는 요소가 있으면 계산하지 않는다.
 * allowFirst: 첫 요소도 민다(묶음 안의 하위 줄 — 첫 줄 앞 여백 = 묶음 전체를 미는 것과 같다)
 */
export function foldPush(
  viewport: number,
  top: number,
  heights: (number | undefined)[],
  gap: number,
  allowFirst = false,
): {index: number; space: number} | null {
  if (viewport <= 0 || heights.some(h => h === undefined)) {
    return null;
  }
  let y = top;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i] as number;
    if (i > 0) {
      y += gap;
    }
    const bottom = y + h;
    if (y < viewport && bottom > viewport + 0.5) {
      // 이미 첫 화면에 일부만 보이는 요소: 위가 접힘보다 아래로 가게 민다(요소가 한 화면보다 크면 두고 스크롤로)
      return h < viewport && (allowFirst || y > top) ? {index: i, space: Math.ceil(viewport - y) + 1} : null;
    }
    y = bottom;
  }
  return null;
}
