import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Icon, type IconName} from '../assets/icons';
import {Text} from './Text';
import {ds, minTouch} from './roles';
import {useAudience} from './audience';

export type ChoiceItem = {key: string; label: string; icon?: IconName; hint?: string};
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
};

const c = ds.color;
/** P5 답 고르기 행 최소 높이(시안 ds4b 96). 높이는 minHeight 만 */
const ANSWER_MIN_H = 96;

// 선택지(SUMMARY 2-6 C4·Q5): 1열, 같은 면(흰 카드), 테두리 line(3:1), 사물 아이콘만 다르게, 글은 두 줄까지 줄바꿈(말줄임 없음).
// 고른 것은 면 actionSoft + 굵은 테두리 + 체크 아이콘(색만으로 구분하지 않음).
export function Choice({items, mode, value, onSelect, accessibilityLabel, testID = 'choice', look = 'list', selectedLabel, disabled}: ChoiceProps) {
  const a = useAudience();
  const answer = look === 'answer';
  return (
    <View testID={testID} accessibilityRole={mode === 'radio' ? 'radiogroup' : undefined} accessibilityLabel={accessibilityLabel} style={styles.list}>
      {items.map(item => {
        const selected = mode === 'radio' && value === item.key;
        return (
          <Pressable
            key={item.key}
            testID={`${testID}-${item.key}`}
            accessibilityRole={mode === 'radio' ? 'radio' : 'button'}
            accessibilityLabel={item.label}
            accessibilityHint={item.hint}
            accessibilityState={mode === 'radio' ? {checked: selected, selected, disabled: !!disabled} : disabled ? {disabled: true} : undefined}
            disabled={disabled}
            onPress={() => onSelect(item.key)}
            style={({pressed}) => [
              styles.item,
              {minHeight: answer ? ANSWER_MIN_H : minTouch('choice', a)},
              answer ? styles.answer : null,
              pressed ? styles.pressed : null,
              selected ? (answer ? styles.answerSelected : styles.selected) : null,
            ]}>
            {item.icon ? <Icon name={item.icon} size={a === 'elder' ? 32 : 28} color={c.action} /> : null}
            <View style={answer ? styles.answerBody : styles.body}>
              <Text role={answer ? 'title' : 'bodyLg'}>{item.label}</Text>
              {item.hint ? (
                // 옅은 면(actionSoft) 위에는 보조색을 쓰지 않는다(허용 목록) → 고른 상태는 본문색
                <Text role={selected ? 'body' : 'sub'} tone={selected ? 'default' : 'muted'}>
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
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: c.card, borderWidth: 2, borderColor: c.line, borderRadius: ds.radius.select,
  },
  pressed: {backgroundColor: c.paperSoft},
  selected: {backgroundColor: c.actionSoft, borderColor: c.action, borderWidth: 4},
  body: {flex: 1, gap: 2},
  answerBody: {flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 2},
  // 테두리가 1.5 → 5 로 굵어져도 내용 자리가 움직이지 않게 안쪽 여백을 그만큼 줄인다(가로·세로). 좁으면 '✓ 골랐어요'가 다음 줄로
  answer: {borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 14, flexWrap: 'wrap'},
  answerSelected: {backgroundColor: c.actionSoft, borderColor: c.action, borderWidth: 5, paddingHorizontal: 16.5, paddingVertical: 10.5},
  selectedTag: {flexDirection: 'row', alignItems: 'center', gap: 8},
});
