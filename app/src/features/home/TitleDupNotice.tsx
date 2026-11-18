import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {SmallButton} from '../../ui/SmallButton';
import {BottomSheet} from '../../ui/BottomSheet';
import {useToast} from '../../ui/Toast';
import {copy} from '../../copy/copy';
import {color, radius, size} from '../../ui/tokens';
import {isOffline, PARENT_TITLES} from '../types';
import type {Api} from '../types';
import type {TitleDup} from './titleDup';
import {monthDayText} from '../../lib/childFormat';

const h = copy.child.home;
const t = h.title_sheet;

// C4 호칭 겹침 안내 줄 + 이름 고르기 시트(시안 C4_title_dup, 문구 copy-v3 11-8).
// 닫을 수 없는 줄(겹치면 화면에서 구분이 안 되므로), 바꾸면 사라진다. 다른 분이 쓰는 이름은 막고 '이미 쓰는 이름'으로 알린다.
export function TitleDupNotice({api, dup, onChanged}: {api: Api; dup: TitleDup; onChanged: () => void}) {
  const [open, setOpen] = useState(false);
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
    <View testID="title-dup" style={styles.box}>
      <Text20 weight="bold" style={styles.text}>{h.title_dup}</Text20>
      <SmallButton
        label={h.title_dup_button}
        onPress={() => {
          setPicked(null);
          setError(null);
          setOpen(true);
        }}
      />
      <BottomSheet
        testID="title-dup-sheet"
        visible={open}
        title={t.title}
        body={hint}
        closeLabel={copy.child.cheer.close}
        onClose={() => setOpen(false)}
        error={error}
        primary={{label: t.save, onPress: save, disabled: !picked || saving}}
        secondary={{label: t.later, onPress: () => setOpen(false)}}>
        <View style={styles.options}>
          {PARENT_TITLES.map(name => {
            const taken = dup.taken.includes(name);
            const on = picked === name;
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={taken ? withName(t.taken_a11y, name) : name}
                accessibilityState={{checked: on, disabled: taken}}
                disabled={taken}
                onPress={() => setPicked(name)}
                style={[styles.option, on ? styles.optionOn : null, taken ? styles.optionTaken : null]}>
                <Text20 size={22} weight="bold" style={taken ? styles.takenText : null}>{name}</Text20>
                {taken ? <Text20 style={styles.takenText}>{t.taken}</Text20> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const withName = (tpl: string, name: string) => tpl.split('{이름}').join(name);

const styles = StyleSheet.create({
  box: {backgroundColor: color.noticeSoft, borderRadius: radius.card, padding: 16, gap: 8},
  text: {color: color.inkTitle},
  options: {gap: 8, paddingVertical: 4},
  option: {
    minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderRadius: radius.childCard, borderWidth: 2, borderColor: color.lineSoft, backgroundColor: color.card,
  },
  optionOn: {borderColor: color.action, borderWidth: 3, backgroundColor: color.actionSoft},
  optionTaken: {backgroundColor: color.disabledBg, borderColor: color.disabledBg},
  takenText: {color: color.disabledInk},
});
