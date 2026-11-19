import {useEffect, useState} from 'react';
import type {LayoutChangeEvent, ViewStyle} from 'react-native';
import {foldPush} from './foldPush';

/**
 * 접힘 경계 맞춤(RULES-V4 R-15 '모든 배율에서 접힘 경계는 줄·요소 경계'): 첫 화면 끝(스크롤 창 아래 끝)이
 * 묶음 안 한 요소를 가르면 그 요소 위에 간격(marginTop)을 넣어 통째로 접힘 밖으로 민다. 간격 크기는 잰 값(고정값 없음).
 *
 * 쓰는 법: 묶음 View 는 본문(스크롤 내용)의 바로 아래 자식이어야 한다(onBlock 의 y = 스크롤 내용 안 위치).
 *   <Screen onViewport={fold.onViewport}> … <View onLayout={fold.onBlock} style={{gap}}> {items.map((x, i) => <View onLayout={fold.onItem(i)} style={fold.gapStyle(i)}/>)} </View>
 * 계산은 ui/ds/foldPush(어르신 FoldStack 과 공용, PR #91 리뷰 L1) — 경계 동작은 그 주석과 foldPush.test.ts.
 * 요소 위치는 높이만으로 쌓아 계산한다(묶음 위 끝 + 앞 요소 높이 합 + 사이 간격). 간격(marginTop)은 높이를 바꾸지 않아 판정을 흔들지 않는다.
 * (onLayout y 에서 간격을 빼 기록하는 방식은 측정 시점과 간격 상태가 어긋나 켜졌다 꺼졌다 했다 — C3 에뮬레이터 실측 11-19)
 * from: 이 번호부터만 민다(앞 요소는 첫 화면에 남기는 것이 시안. 예: C4 빈 상태의 안내 한 줄)
 * glue: 다음 요소와 붙여 미는 번호(묶음 제목 등). 다음 요소가 걸리면 제목째 민다 — 첫 화면 끝에 제목만 남지 않게(PR #83 재확인 L9)
 * onViewport 에는 띠 유무와 무관한 접힘 기준 창을 넘긴다(PR #83 재확인 H1). DsScreen 의 onViewport 가 그 값(본문 영역 − 띠)이다.
 *   스크롤 창 높이를 그대로 쓰면 맨 아래에서 띠가 사라질 때 간격이 다시 계산돼 튄다.
 *   (지금까지 잰 가장 큰 값 − 띠 로 고정하는 판은 첫 배치의 일시적으로 큰 값을 잡아 틀렸다 — 에뮬레이터 실측)
 */
export function useFoldGap(count: number, between: number, from = 0, glue: readonly number[] = []) {
  const [viewH, setViewH] = useState(0);
  const [pushAt, setPushAt] = useState(0); // 민 요소의 위 끝이 갈 곳(기본 = viewH). 겹쳐 그리는 흐림이 있으면 흐림 아래 끝(창 끝)
  const [blockY, setBlockY] = useState<number | null>(null);
  const [hs, setHs] = useState<Record<number, number>>({});
  const [gap, setGap] = useState<{before: number; h: number} | null>(null);
  useEffect(() => {
    if (!viewH || blockY === null) {
      return;
    }
    const heights = Array.from({length: count}, (_, i) => hs[i]);
    if (heights.some(h => h === undefined)) {
      return; // 다 잰 뒤에
    }
    // 계산은 foldPush 하나(어르신 FoldStack 과 같은 것, PR #91 리뷰 L1). 묶음 첫 요소도 민다(allowFirst = 묶음째)
    const found = foldPush(viewH, blockY, heights, between, {allowFirst: true, from, glue, pushTo: pushAt});
    const next = found ? {before: found.index, h: found.space} : null;
    if ((next?.before ?? -1) !== (gap?.before ?? -1) || Math.abs((next?.h ?? 0) - (gap?.h ?? 0)) > 1) {
      setGap(next);
    }
  }, [viewH, pushAt, blockY, hs, gap, count, between, from, glue]);
  return {
    /** h = 접힘 기준(여기서 걸치면 민다), pushTo = 민 요소가 갈 위치(겹쳐 그리는 흐림이 있으면 그 아래 끝, 없으면 생략) */
    onViewport: (h: number, pushTo?: number) => {
      setViewH(h);
      setPushAt(pushTo ?? h);
    },
    onBlock: (e: LayoutChangeEvent) => setBlockY(e.nativeEvent.layout.y),
    onItem: (i: number) => (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setHs(cur => (cur[i] === h ? cur : {...cur, [i]: h}));
    },
    gapStyle: (i: number): ViewStyle | undefined => (gap && gap.before === i ? {marginTop: gap.h} : undefined),
  };
}
