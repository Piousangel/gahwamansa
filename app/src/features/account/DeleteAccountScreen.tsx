import React, {useEffect, useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius} from '../../ui/tokens';
import {appCopy, copy, withTitle, Message} from '../../copy/copy';
import type {DeleteScope} from '../types';
import {errorMessage} from '../course/useFinishStep';

type Props = {role: 'parent' | 'child'};

// 단계별 경고. "그만둘래요"가 주 버튼. 어르신: 지우기 -> 한 번 더 확인. 자녀: 계정 지우기 -> (마지막 자녀면 '지우기' 입력) -> 계정 지우기.
export function DeleteAccountScreen({role}: Props) {
  const navigation = useNavigation();
  const {api, clear} = useSession();
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Message | null>(null);
  const child = role === 'child';
  const dp = copy.delete.parent;
  const dc = copy.delete.child;

  // 삭제 범위 사전 조회. 실패하면 가장 강한 경고(family)로 대체한다(보수적).
  const [scope, setScope] = useState<DeleteScope | null>(null);
  const [title, setTitle] = useState('부모님');
  useEffect(() => {
    let alive = true;
    api
      .deleteScopePreview()
      .then(r => alive && setScope(r.scope))
      .catch(() => alive && setScope('family'));
    if (child) {
      api
        .fetchChildSummary()
        .then(s => alive && setTitle(s.parentTitle))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [api, child]);
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
      navigation.dispatch(
        CommonActions.reset({index: 0, routes: [{name: 'DeleteDone', params: {scope: r.scope, role, title}}]}),
      );
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnabled = !busy && (!strong || typed.trim() === dc.type_word);

  return (
    <Screen>
      {child && scope === null ? (
        <Text20>{appCopy.loading}</Text20>
      ) : child ? (
        <>
          {strong ? (
            <View style={styles.box}>
              <Text20 size={24} weight="bold">{withTitle(dc.last_title, title)}</Text20>
              <Text20 size={24} weight="bold">{withTitle(dc.last_body, title)}</Text20>
            </View>
          ) : (
            <>
              <Text20 size={24} weight="bold">{dc.keep_title}</Text20>
              <Text20>{withTitle(dc.keep_body, title)}</Text20>
            </>
          )}
          <Text20 weight="bold">{dc.warn_label}</Text20>
        </>
      ) : (
        <>
          <Text20 size={26} weight="bold">{dp.title}</Text20>
          <Text20 size={24}>{dp.body}</Text20>
        </>
      )}

      {stage === 2 ? (
        strong ? (
          <>
            <Text20>{dc.type_hint}</Text20>
            <TextInput accessibilityLabel="확인 글자 입력" value={typed} onChangeText={setTyped} style={styles.input} />
          </>
        ) : child ? null : (
          <Text20 size={26} weight="bold">{dp.ask}</Text20>
        )
      ) : null}

      <BigButton label={child ? dc.cancel : dp.cancel} onPress={() => navigation.goBack()} />
      {stage === 1 ? (
        <BigButton
          variant="secondary"
          label={child ? dc.danger : dp.start}
          disabled={child && scope === null}
          onPress={() => setStage(2)}
        />
      ) : (
        <BigButton
          variant="secondary"
          label={child ? dc.danger : dp.yes}
          disabled={!confirmEnabled}
          onPress={run}
        />
      )}
      {failed ? (
        <>
          <Text20 size={24} weight="bold">{child ? dc.fail : dp.fail_title}</Text20>
          {child ? null : <Text20>{dp.fail_body}</Text20>}
          <BigButton variant="secondary" label={failed.button} onPress={run} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {borderWidth: 4, borderColor: color.actionDark, backgroundColor: color.actionSoft, borderRadius: radius.card, padding: 16, marginBottom: 12},
  input: {minHeight: 64, fontSize: 28, borderWidth: 3, borderColor: color.line, borderRadius: radius.chip, backgroundColor: color.card, paddingHorizontal: 12, color: color.ink},
});
