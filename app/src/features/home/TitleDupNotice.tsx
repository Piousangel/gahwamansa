import React, {useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Choice, Sheet, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {Icon} from '../../ui/assets/icons';
import {useToast} from '../../ui/Toast';
import {copy} from '../../copy/copy';
import {isOffline, PARENT_TITLES} from '../types';
import type {Api, ChildParent} from '../types';
import type {TitleDup} from './titleDup';
import {monthDayText} from '../../lib/childFormat';

const h = copy.child.home;
const t = h.title_sheet;

// C4 호칭 겹침 안내 줄 + 이름 고르기 시트(시안 C4_title_dup, 문구 copy-v3 11-8).
// 닫을 수 없는 줄(겹치면 화면에서 구분이 안 되므로), 바꾸면 사라진다. 다른 분이 쓰는 이름은 막고 '이미 쓰는 이름'으로 알린다.
// 칩 줄(시안 '부모님 고르기'): 어르신 호칭을 연결 순서로, 새로 연결된 분 칩을 표시(현재). 겹친 동안만 보이는 표시용(누르는 동작은 시안에 정의 없음)
export function TitleDupNotice({api, dup, parents, onChanged}: {api: Api; dup: TitleDup; parents: ChildParent[]; onChanged: () => void}) {
  const [open, setOpen] = useState(false);
  const opener = useRef(null); // 시트가 닫히면 '이름 고르기'로 포커스(ds Sheet returnFocusRef)
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {show} = useToast();
  const date = dup.target.connectedDate;
  const hint = date ? monthDayText(t.hint_date, date) : t.hint;

  const save = async () => {
    if (!picked || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await api.setParentTitleFor(dup.target.parentId, picked);
      if (!r.ok) {
        setError(r.reason === 'duplicate_title' ? copy.relation.name_taken : copy.errors.server.title);
        return;
      }
      setOpen(false);
      show({text: copy.child.settings.name_changed}); // "부르는 이름을 바꿨어요"(11-8: 조사 문제로 이름을 넣지 않음)
      onChanged();
    } catch (e) {
      setError(isOffline(e) ? copy.errors.offline.title : copy.errors.server.title);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* 라이터 11-14(리뷰 M3): 칩은 누를 수 없는 표시용 → 줄 전체를 한 덩어리로 읽고 칩 각각은 읽지 않는다. 새로 연결된 분 칩은 ✓ + 굵은 테두리(색만으로 구분하지 않음) */}
      <View testID="title-dup-chips" style={styles.chips} accessible accessibilityLabel={chipsA11y(parents, dup.target.parentId)}>
        {parents.map(p => {
          const cur = p.parentId === dup.target.parentId;
          return (
            <View key={p.parentId} style={[styles.chip, cur ? styles.chipOn : null]}>
              {cur ? <Icon name="icon-check" size={20} color={ds.color.action} /> : null}
              <Text role="body">{p.title}</Text>
            </View>
          );
        })}
      </View>
      <Card tone="notice" testID="title-dup">
        <Text role="bodyLg">{h.title_dup}</Text>
        <Button
          kind="secondary"
          size="inline"
          label={h.title_dup_button}
          buttonRef={opener}
          onPress={() => {
            setPicked(null);
            setError(null);
            setOpen(true);
          }}
        />
      </Card>
      <Sheet
        testID="title-dup-sheet"
        visible={open}
        title={t.title}
        sub={hint}
        onClose={() => setOpen(false)}
        returnFocusRef={opener}
        footer={
          <>
            <View accessibilityLiveRegion="polite">
              {error ? (
                <Text role="body" tone="danger" testID="title-dup-error">
                  {error}
                </Text>
              ) : null}
            </View>
            <Button kind="primary" size="dock" label={t.save} onPress={save} disabled={!picked || saving} loading={saving} />
            <Button kind="text" size="inline" label={t.later} onPress={() => setOpen(false)} />
          </>
        }>
        <Choice
          mode="radio"
          columns={2}
          testID="title-dup-options"
          accessibilityLabel={t.title}
          items={PARENT_TITLES.map(name => {
            const taken = dup.taken.includes(name);
            return {key: name, label: name, disabled: taken, hint: taken ? t.taken : undefined, a11yLabel: taken ? withName(t.taken_a11y, name) : name};
          })}
          value={picked ?? undefined}
          onSelect={setPicked}
        />
      </Sheet>
    </View>
  );
}

const withName = (tpl: string, name: string) => tpl.split('{이름}').join(name);

// "연결된 분 이름, 부모님, 부모님. 새로 연결된 분은 두 번째예요" — {순서}는 첫·두·세(keyboard.count_words, 첫째만 '첫')
export function chipsA11y(parents: ChildParent[], targetId: string): string {
  const n = parents.findIndex(p => p.parentId === targetId) + 1;
  const words = copy.keyboard.count_words;
  const order = n === 1 ? '첫' : words[n - 1] ?? String(n);
  return h.title_dup_chips_a11y.split('{이름들}').join(parents.map(p => p.title).join(', ')).split('{순서}').join(order);
}

const styles = StyleSheet.create({
  wrap: {gap: 14},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18,
    borderRadius: ds.radius.chip, borderWidth: 2, borderColor: ds.color.line, backgroundColor: ds.color.card,
  },
  chipOn: {backgroundColor: ds.color.actionSoft, borderColor: ds.color.action, borderWidth: 4, paddingHorizontal: 16},
});
