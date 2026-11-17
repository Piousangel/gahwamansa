import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {BackBar} from '../../app/BackBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {Banner} from '../../ui/Banner';
import {BottomSheet} from '../../ui/BottomSheet';
import {Icon} from '../../ui/assets/icons';
import {appCopy, copy, Message} from '../../copy/copy';
import {color, radius, size} from '../../ui/tokens';
import type {ParentFamily} from '../../api/contract/family';
import {childErrorMessage} from '../../shared/childError';
import {familyDateText} from './familyLogic';

const f = copy.family;
const s = f.stop_sheet;

// P16 연결된 가족(시안 parent/P16_family, 문구 copy-v3 11-8, 서버 0030 parent_family_list).
// 자녀 이름은 없다: 행마다 "가족 휴대폰 / {월}월 {일}일에 연결했어요". 그만두기는 두 갈래(DECISIONS 11-17):
//   그만 보여 주기 = withdraw_consent(연결 유지, 확인 상자 없이 바로 + 되돌리는 길 안내) / 모두 지우기 = P9 두 단계 확인으로.
// TODO(U0): 어르신 화면은 대화상자가 원칙이지만 동결 시안이 두 갈래 시트라 BottomSheet 를 쓴다(갈래마다 보조 글이 있어서).
export function ParentFamilyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentParams>>();
  const {api, consented, setConsented} = useSession();
  const [data, setData] = useState<ParentFamily | null>(null);
  const [error, setError] = useState<Message | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await api.parentFamilyList();
      if (mine === seq.current) {
        setData(r);
      }
    } catch (e) {
      if (mine === seq.current) {
        setError(childErrorMessage(e, copy.errors.server));
      }
    }
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  const stopSharing = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setSheetError(null);
    try {
      await api.withdrawConsent();
      setConsented(false);
      setSheet(false);
      setNotice(copy.settings.stopped); // 바로 실행 + 되돌리는 길 한 줄(11-8)
    } catch (e) {
      setSheetError(childErrorMessage(e, copy.errors.server).title); // 시트 안 오류 줄
    } finally {
      setBusy(false);
    }
  };
  const toDelete = () => {
    setSheet(false);
    navigation.navigate('DeleteAccount'); // P9 두 단계 확인(여기서 지우지 않음)
  };

  const top = (
    <>
      <BackBar />
      <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>{f.title}</Text20>
    </>
  );

  if (error && !data) {
    return (
      <Screen top={top}>
        <Text20 size={24} weight="bold">{error.title}</Text20>
        <Text20>{error.body}</Text20>
        <BigButton variant="secondary" label={error.button} onPress={load} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen top={top}>
        <Text20>{appCopy.loading}</Text20>
      </Screen>
    );
  }
  if (data.family.length === 0) {
    return (
      <Screen top={top} bottom={<BigButton label={f.empty_button} onPress={() => navigation.push('Connect', {from: 'course'})} />}>
        <Text20 size={24} weight="bold">{f.empty}</Text20>
        <Text20>{f.empty_hint}</Text20>
      </Screen>
    );
  }

  return (
    <View style={styles.flex}>
      <Screen top={top}>
        {notice ? <Banner kind="success" text={notice} onHidden={() => setNotice(null)} /> : null}
        <Text20 size={24} weight="bold" style={styles.title}>{f.summary.split('{n}').join(String(data.family.length))}</Text20>
        <View style={styles.list}>
          {data.family.map(m => {
            const date = familyDateText(f.row_date, m.connectedDate);
            return (
              <View key={m.seq} testID="family-row" style={styles.row} accessible accessibilityLabel={`${f.row}, ${date}`}>
                <Icon name="icon-family" size={28} color={color.action} />
                <View style={styles.flex}>
                  <Text20 weight="bold">{f.row}</Text20>
                  <Text20 style={styles.sub}>{date}</Text20>
                </View>
              </View>
            );
          })}
        </View>
        <Text20 style={styles.sub}>{f.add_hint}</Text20>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${f.stop_row}, ${f.stop_sub}`}
          onPress={() => {
            setSheetError(null);
            setSheet(true);
          }}
          style={({pressed}) => [styles.row, styles.stop, pressed ? styles.pressed : null]}>
          <View style={styles.flex}>
            <Text20 weight="bold">{f.stop_row}</Text20>
            <Text20 style={styles.sub}>{f.stop_sub}</Text20>
          </View>
          <Icon name="icon-chevron-right" size={24} color={color.inkSub} />
        </Pressable>
      </Screen>
      <BottomSheet
        testID="family-stop-sheet"
        visible={sheet}
        title={s.title}
        body={s.hint}
        closeLabel={s.cancel}
        onClose={() => setSheet(false)}
        error={sheetError}
        primary={{label: s.cancel, onPress: () => setSheet(false)}}>
        <View style={styles.options}>
          {consented ? <Option label={s.share} sub={s.share_sub} onPress={stopSharing} disabled={busy} /> : null}
          <Option label={s.delete} sub={s.delete_sub} onPress={toDelete} disabled={busy} danger />
        </View>
      </BottomSheet>
    </View>
  );
}

function Option({label, sub, onPress, disabled, danger}: {label: string; sub: string; onPress: () => void; disabled?: boolean; danger?: boolean}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${sub}`}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [styles.option, danger ? styles.optionDanger : null, pressed ? styles.pressed : null]}>
      <Text20 size={22} weight="bold" style={danger ? styles.danger : null}>{label}</Text20>
      <Text20 style={styles.sub}>{sub}</Text20>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  list: {gap: 10},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.touchMin, backgroundColor: color.card, borderRadius: radius.card, padding: 16},
  stop: {marginTop: 8},
  pressed: {opacity: 0.7},
  options: {gap: 12, paddingVertical: 8},
  option: {minHeight: size.touchMin, padding: 16, borderRadius: radius.card, borderWidth: 3, borderColor: color.line, backgroundColor: color.card, gap: 4},
  optionDanger: {borderColor: color.dangerInk},
  danger: {color: color.dangerInk},
});
