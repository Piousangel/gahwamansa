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
};

const c = ds.color;

// 선택지(SUMMARY 2-6 C4·Q5): 1열, 같은 면(흰 카드), 테두리 line(3:1), 사물 아이콘만 다르게, 글은 두 줄까지 줄바꿈(말줄임 없음).
// 고른 것은 면 actionSoft + 굵은 테두리 + 체크 아이콘(색만으로 구분하지 않음).
export function Choice({items, mode, value, onSelect, accessibilityLabel, testID = 'choice'}: ChoiceProps) {
  const a = useAudience();
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
            accessibilityState={mode === 'radio' ? {checked: selected, selected} : undefined}
            onPress={() => onSelect(item.key)}
            style={({pressed}) => [styles.item, {minHeight: minTouch('choice', a)}, pressed ? styles.pressed : null, selected ? styles.selected : null]}>
            {item.icon ? <Icon name={item.icon} size={a === 'elder' ? 32 : 28} color={c.action} /> : null}
            <View style={styles.body}>
              <Text role="bodyLg">{item.label}</Text>
              {item.hint ? (
                // 옅은 면(actionSoft) 위에는 보조색을 쓰지 않는다(허용 목록) → 고른 상태는 본문색
                <Text role={selected ? 'body' : 'sub'} tone={selected ? 'default' : 'muted'}>
                  {item.hint}
                </Text>
              ) : null}
            </View>
            {selected ? <Icon name="icon-check" size={28} color={c.action} /> : null}
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
});
