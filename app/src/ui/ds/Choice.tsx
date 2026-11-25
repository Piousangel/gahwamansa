import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Icon, type IconName} from '../assets/icons';
import {Text} from './Text';
import {ds, minTouch, roleText} from './roles';
import {estimateLines} from './dockLayout';
import {useAudience} from './audience';
import {layout} from '../tokens';

export type ChoiceItem = {
  key: string;
  label: string;
  icon?: IconName;
  hint?: string;
  /** 이 칸만 고를 수 없음(예: 다른 분이 쓰는 호칭). 읽기 이름은 a11yLabel 로 이유를 담는다 */
  disabled?: boolean;
  a11yLabel?: string;
};
export type ChoiceProps = {
  items: readonly ChoiceItem[];
  /** radio: 하나를 고른다(value). action: 누르면 바로 행동(응원 선택지) */
  mode: 'radio' | 'action';
  value?: string;
  onSelect: (key: string) => void;
  /** 묶음 이름(TalkBack radiogroup 라벨) */
  accessibilityLabel?: string;
  testID?: string;
  /**
   * answer: 어르신 답 고르기(P5 시안 ds4b) — 선택지 글은 title 역할, 행 최소 96, 테두리 line 1.5 / 고른 것 action 5.
   * 기본(list)은 응원 선택지(C4)처럼 bodyLg·최소 높이 토큰
   */
  look?: 'list' | 'answer';
  /** 고른 칸 오른쪽 ✓ 옆 글자('골랐어요', 색만으로 구분하지 않음). ui 는 문구를 모르니 호출부가 copy 에서 넘긴다 */
  selectedLabel?: string;
  /** 저장 중 등 누르기 막음 */
  disabled?: boolean;
  /**
   * R-15 접힘 경계 맞춤(화면의 FoldStack split·useFoldGap.onHeights): 줄별 높이 알림 + 이 줄 앞에 넣을 여백.
   * 1열이면 줄 = 칸, 2열이면 줄 = 두 칸(높이는 큰 쪽, 여백은 그 줄 두 칸 모두에) — 첫 화면 끝이 칸을 반쯤 가르지 않게
   */
  onItemHeights?: (heights: number[]) => void;
  push?: {index: number; space: number} | null;
  /**
   * 열 수(기본 1). 2 면 두 칸씩(예: 호칭 7개, 디자인 결정 a — 360에서 칸 폭 약 154로 2~4자 호칭이 들어감, 읽는 순서는 행 우선).
   * 글자 150% 이상이거나 한 칸 폭에서 글이 줄바꿈되면 저절로 1열(칸이 좁아 글이 꺾이지 않게)
   */
  columns?: 1 | 2;
  /** answer 모양의 행 최소 높이(기본 96). 5단계 ②·⑤ 카드는 64(시안 docs/design/2026-11-25-five-steps s2·s3) */
  minItemHeight?: number;
  /** answer 모양에서 '✓ 골랐어요'를 늘 글 아래 줄로(⑤ 문장 카드·② 200% — 옆에 두면 글이 한 글자씩 꺾인다, 시안 s2·s3) */
  tagBelow?: boolean;
};

/** 2열을 쓸 수 있는지: 글자 150% 미만이고 모든 글(이름·보조 줄)이 한 칸 폭에서 한 줄 */
export function fitsTwoColumns(items: readonly Pick<ChoiceItem, 'label' | 'hint' | 'disabled'>[], listWidth: number, fontPx: number, fontScale: number, hintPx = fontPx): boolean {
  if (fontScale >= 1.5 || listWidth <= 0) {
    return false;
  }
  const cell = (listWidth - COL_GAP) / 2;
  const textW = cell - GRID_PAD_X * 2 - ITEM_BORDER * 2 - GRID_CHECK_W; // 고른 칸의 ✓ 자리까지 비워 둔다
  // 막힌 칸은 고를 수 없어 ✓ 자리가 필요 없다(보조 줄 '이미 쓰는 이름'이 그만큼 더 들어감)
  return items.every(x => {
    const w = x.disabled ? textW + GRID_CHECK_W : textW;
    return estimateLines(x.label, fontPx * fontScale, w) === 1 && (!x.hint || estimateLines(x.hint, hintPx * fontScale, w) === 1);
  });
}

const c = ds.color;
/** P5 답 고르기 행 최소 높이(시안 ds4b 96). 높이는 minHeight 만 */
const ANSWER_MIN_H = 96;
/** 2열 칸 사이·1열 칸 안 여백·테두리(fitsTwoColumns 와 스타일이 같은 값을 쓴다) */
const COL_GAP = 12;
const ITEM_PAD_X = 16;
const ITEM_BORDER = 4; // 고른 칸 테두리(가장 굵은 쪽)
/** 2열 칸은 폭이 좁아 안쪽 여백·✓ 간격을 줄인다(360에서 칸 약 150 → 글 자리 82, 4자 호칭 18px ≈ 71) */
const GRID_PAD_X = 12;
const GRID_GAP = 8;
/** 자녀 호칭 고르기(2열 지정) 줄 사이: 12 → 8(C1 360×640 100%에서 4줄째가 첫 화면에 들게, 디자인 리뷰 11-20 ② — R-12 '요소 사이 8 이상').
 *  1열로 내려가도(150%↑·꺾임) 같은 값이라 접힘 계산(useFoldGap between)이 하나로 맞는다 */
export const CHOICE_CHILD_GRID_ROW_GAP = 8;
const GRID_CHECK_W = 28 + GRID_GAP;

// 선택지(SUMMARY 2-6 C4·Q5): 1열, 같은 면(흰 카드), 테두리 line(3:1), 사물 아이콘만 다르게, 글은 두 줄까지 줄바꿈(말줄임 없음).
// 고른 것은 면 actionSoft + 굵은 테두리 + 체크 아이콘(색만으로 구분하지 않음).
export function Choice({items, mode, value, onSelect, accessibilityLabel, testID = 'choice', look = 'list', selectedLabel, disabled, onItemHeights, push, columns = 1, minItemHeight, tagBelow}: ChoiceProps) {
  const a = useAudience();
  const answer = look === 'answer';
  const {width: winW, fontScale} = useWindowDimensions();
  // #115 리뷰 L1: 첫 판정은 1열. 목록 폭을 잰 뒤에만 2열로 바꾼다(1열↔2열이 한 번 바뀌는 프레임을 만들지 않게 — 1열에서 2열로 한 번만)
  const [listW, setListW] = useState(0);
  // L2: 어림(estimateLines)으로 2열을 골랐는데 실제로 칸에서 글이 꺾이면(onTextLayout 줄 수 > 1) 1열로 내리고 다시 올리지 않는다(한 방향)
  const [wrapped, setWrapped] = useState(false);
  const width = listW || winW - layout.bodyPadding.x * 2;
  const two =
    columns === 2 && !answer && listW > 0 && !wrapped && fitsTwoColumns(items, listW, roleText('bodyLg', a).style.fontSize as number, fontScale, roleText('sub', a).style.fontSize as number);
  const onLines = two ? (n: number) => n > 1 && setWrapped(true) : undefined;
  const cellW = two ? (width - COL_GAP) / 2 : undefined;
  const per = two ? 2 : 1;
  const hs = useRef<number[]>([]);
  const onItem = (i: number, h: number) => {
    if (!onItemHeights || hs.current[i] === h) {
      return;
    }
    hs.current[i] = h;
    if (items.every((_, j) => hs.current[j] !== undefined)) {
      const rows: number[] = [];
      items.forEach((_, j) => {
        const r = Math.floor(j / per);
        rows[r] = Math.max(rows[r] ?? 0, hs.current[j]);
      });
      onItemHeights(rows);
    }
  };
  return (
    <View
      testID={testID}
      accessibilityRole={mode === 'radio' ? 'radiogroup' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.list, columns === 2 && a === 'child' ? styles.listChildGrid : null, two ? styles.grid : null]}
      onLayout={columns === 2 ? e => setListW(Math.round(e.nativeEvent.layout.width)) : undefined}>
      {items.map((item, i) => {
        const selected = mode === 'radio' && value === item.key;
        const off = disabled || item.disabled;
        return (
          <Pressable
            key={item.key}
            onLayout={onItemHeights ? e => onItem(i, Math.round(e.nativeEvent.layout.height)) : undefined}
            testID={`${testID}-${item.key}`}
            accessibilityRole={mode === 'radio' ? 'radio' : 'button'}
            accessibilityLabel={item.a11yLabel ?? item.label}
            accessibilityHint={item.hint}
            accessibilityState={mode === 'radio' ? {checked: selected, selected, disabled: !!off} : off ? {disabled: true} : undefined}
            disabled={off}
            onPress={() => onSelect(item.key)}
            style={({pressed}) => [
              styles.item,
              a === 'child' && !answer ? styles.itemChild : null,
              {minHeight: answer ? minItemHeight ?? ANSWER_MIN_H : minTouch('choice', a)},
              answer ? styles.answer : null,
              pressed ? styles.pressed : null,
              selected ? (answer ? styles.answerSelected : styles.selected) : null,
              push && push.index === Math.floor(i / per) ? {marginTop: push.space} : null,
              cellW ? {width: cellW, paddingHorizontal: GRID_PAD_X, gap: GRID_GAP} : null,
              item.disabled ? styles.itemOff : null,
            ]}>
            {item.icon ? <Icon name={item.icon} size={a === 'elder' ? 32 : 28} color={c.action} /> : null}
            <View style={answer ? [styles.answerBody, tagBelow ? styles.answerBodyFull : null] : styles.body}>
              <Text role={answer ? 'title' : 'bodyLg'} onLines={onLines}>
                {item.label}
              </Text>
              {item.hint ? (
                // 옅은 면(actionSoft) 위에는 보조색을 쓰지 않는다(허용 목록) → 고른 상태는 본문색
                <Text role={selected ? 'body' : 'sub'} tone={selected ? 'default' : 'muted'} onLines={onLines}>
                  {item.hint}
                </Text>
              ) : null}
            </View>
            {selected && selectedLabel ? (
              <View style={styles.selectedTag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="icon-check" size={28} color={c.doneInk} />
                <Text role="bodyLg" tone="done">{selectedLabel}</Text>
              </View>
            ) : selected ? (
              <Icon name="icon-check" size={28} color={c.action} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {gap: ds.touch.elder.gap, alignSelf: 'stretch'},
  listChildGrid: {rowGap: CHOICE_CHILD_GRID_ROW_GAP},
  grid: {flexDirection: 'row', flexWrap: 'wrap', columnGap: COL_GAP},
  itemOff: {backgroundColor: c.paperSoft, borderColor: c.lineSoft},
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: ITEM_PAD_X, paddingVertical: 10,
    backgroundColor: c.card, borderWidth: 2, borderColor: c.line, borderRadius: ds.radius.select,
  },
  // 자녀 선택지: 시안 C4_cheer_sheet_ds4 반경 16·테두리 1.5(line, 흰 면 위 3:1 이상). 고른 칸은 그대로 굵은 테두리 4
  itemChild: {borderRadius: ds.radius.childCard, borderWidth: 1.5},
  pressed: {backgroundColor: c.paperSoft},
  selected: {backgroundColor: c.actionSoft, borderColor: c.action, borderWidth: 4},
  body: {flex: 1, gap: 2},
  answerBody: {flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 2},
  // 한 줄 전체 + 줄어들지 않음: flexShrink 1 이면 Yoga 가 줄을 바꾸지 않고 글 칸을 줄여 한 글자씩 꺾는다(#254 실기기 320×640 200% 캡처)
  answerBodyFull: {flexBasis: '100%', flexShrink: 0},
  // 테두리가 1.5 → 5 로 굵어져도 내용 자리가 움직이지 않게 안쪽 여백을 그만큼 줄인다(가로·세로). 좁으면 '✓ 골랐어요'가 다음 줄로
  answer: {borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 14, flexWrap: 'wrap', alignContent: 'center'},
  answerSelected: {backgroundColor: c.actionSoft, borderColor: c.action, borderWidth: 5, paddingHorizontal: 16.5, paddingVertical: 10.5},
  selectedTag: {flexDirection: 'row', alignItems: 'center', gap: 8},
});
