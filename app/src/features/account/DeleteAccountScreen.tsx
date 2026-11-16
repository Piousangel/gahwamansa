import React, {useEffect, useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius} from '../../ui/tokens';
import {appCopy, tempCopy, Message} from '../../copy/copy';
import type {DeleteScope} from '../types';
import {errorMessage} from '../course/useFinishStep';

type Props = {role: 'parent' | 'child'};
const t = tempCopy.del;

// 단계별 경고: 1단계 경고 -> 2단계 확인(어르신: 한 번 더 확인, 자녀: '삭제' 입력).
export function DeleteAccountScreen({role}: Props) {
  const navigation = useNavigation();
  const {api, clear} = useSession();
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Message | null>(null);
  const child = role === 'child';
  // 삭제 범위 사전 조회. 실패하면 가장 강한 경고(family)로 대체한다(보수적).
  const [scope, setScope] = useState<DeleteScope | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .deleteScopePreview()
      .then(r => alive && setScope(r.scope))
      .catch(() => alive && setScope('family'));
    return () => {
      alive = false;
    };
  }, [api]);
  const strong = child && scope === 'family';

  const run = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      const r = await api.deleteMyAccount();
      clear();
      // 뒤로가기로 이전 화면에 못 돌아가게 스택을 결과 화면 하나로 초기화
      navigation.dispatch(
        CommonActions.reset({index: 0, routes: [{name: 'DeleteDone', params: {scope: r.scope, role}}]}),
      );
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnabled = !busy && (!strong || typed.trim() === t.childTypeWord);

  return (
    <Screen>
      {child && scope === null ? (
        <Text20>{appCopy.loading}</Text20>
      ) : strong ? (
        <View style={styles.box}>
          <Text20 size={24} weight="bold">{t.childWarn}</Text20>
          <Text20 size={24} weight="bold">{t.childWarn2}</Text20>
        </View>
      ) : child ? (
        <Text20 size={24} weight="bold">{t.childOnlyMe}</Text20>
      ) : (
        <>
          <Text20 size={26} weight="bold">{t.parentWarn}</Text20>
          <Text20 size={24}>{t.parentWarn2}</Text20>
        </>
      )}

      {stage === 1 ? (
        <BigButton label={child ? t.childStart : t.parentStart} disabled={child && scope === null} onPress={() => setStage(2)} />
      ) : (
        <>
          {strong ? (
            <>
              <Text20>{t.childTypeHint}</Text20>
              <TextInput
                accessibilityLabel="확인 글자 입력"
                value={typed}
                onChangeText={setTyped}
                style={styles.input}
              />
            </>
          ) : (
            <Text20 size={26} weight="bold">{t.parentAsk}</Text20>
          )}
          <BigButton label={child ? t.childYes : t.parentYes} disabled={!confirmEnabled} onPress={run} />
        </>
      )}
      {failed ? (
        <>
          <Text20 size={24} weight="bold">{t.failTitle}</Text20>
          <Text20>{t.failBody}</Text20>
          <BigButton variant="secondary" label={failed.button} onPress={run} />
        </>
      ) : null}
      <BigButton variant="secondary" label={t.cancel} onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {borderWidth: 4, borderColor: color.actionDark, backgroundColor: color.actionSoft, borderRadius: radius.card, padding: 16, marginBottom: 12},
  input: {minHeight: 64, fontSize: 28, borderWidth: 3, borderColor: color.line, borderRadius: radius.chip, backgroundColor: color.card, paddingHorizontal: 12, color: color.ink},
});
