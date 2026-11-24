import React, {useCallback, useEffect, useState} from 'react';
import {View, type LayoutChangeEvent} from 'react-native';
import {foldPush} from './ds/foldPush';

/**
 * 세로 묶음 + 접힘 경계 맞춤(RULES-V4 R-15 '모든 배율에서 접힘 경계는 줄/요소 경계').
 * 본문 스크롤 영역(viewport) 아래 끝에 걸치는 첫 요소를 찾아, 그 요소 앞에 여백을 넣어 통째로 접힘 아래로 민다.
 * 반쯤 잘린 버튼·글줄이 첫 화면에 보이지 않게 하고, 아래 '더 있음' 띠(R-19)가 다음 내용을 알린다.
 * - 계산은 자연 높이(요소 높이 + gap)로만 해서 넣은 여백이 다시 계산을 흔들지 않는다.
 * - 계산은 ui/ds/foldPush 하나(자녀 useFoldGap 과 같은 것, PR #91 리뷰 L1). 큰 요소·첫 요소 규칙은 그쪽 주석.
 * - 자식마다 key 를 준다(위치 id 는 오류 띠·안내 줄이 생기고 사라질 때 다른 요소를 가리킨다, 리뷰 L2).
 * - 이 묶음은 스크롤 내용의 직접 자식이어야 한다(top 값 = 스크롤 내용 안 위치). P1 키패드(CodeInput)와 같은 규칙을 일반화.
 */
export function FoldStack({viewport, gap, children, testID, onFold, split, onTop, onMeasure}: {
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
  /** 묶음 위치(top)와 지금 있는 요소의 자연 높이(key → 높이, 모르는 요소는 빠짐). 화면이 요소 크기를 첫 화면에 맞출 때(P4 사진 높이) */
  onMeasure?: (top: number, heights: Readonly<Record<string, number>>) => void;
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
  const idKey = ids.join('|');
  useEffect(() => {
    if (onMeasure) {
      const now: Record<string, number> = {};
      for (const id of idKey.split('|')) {
        if (heights[id] !== undefined) {
          now[id] = heights[id];
        }
      }
      onMeasure(top, now);
    }
  }, [onMeasure, top, heights, idKey]);
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
          testID={testID ? `${testID}:${ids[i]}` : undefined}
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
