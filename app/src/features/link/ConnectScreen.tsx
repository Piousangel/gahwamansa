import React, {useState} from 'react';
import {errorMessage} from '../course/useFinishStep';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CodeEntry} from './CodeEntry';
import {TextLink} from './TextLink';
import {BackBar} from '../../app/BackBar';
import {canSubmit} from '../../ui/codeInputLogic';
import {AssetPlaceholder} from '../../ui/assets/AssetPlaceholder';
import {copy, reasonToMessage, Message} from '../../copy/copy';

export function ConnectScreen({navigation}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api, resetRole} = useSession();
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.redeemInviteCode(code);
      if (res.ok) {
        navigation.navigate('Consent');
        return;
      }
      setError(reasonToMessage(res.reason));
      setReason(res.reason);
      if (res.reason === 'invalid') {
        setCode(''); // 틀린 번호면 입력을 비운다
      }
    } catch (e) {
      setReason(null);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const onErrorButton = () => {
    setError(null);
    if (reason === 'already_linked') {
      navigation.navigate('Consent');
    } else if (reason === 'not_parent_device') {
      resetRole(); // "처음 화면에서 다시 골라 주세요"
    }
  };

  // 이전: 역할 선택으로(어르신 스택의 첫 화면). 주 버튼은 하단 고정 영역(내비게이션 바 위).
  return (
    <Screen
      top={<BackBar onBack={resetRole} />}
      bottom={
        error ? (
          <BigButton variant="secondary" label={error.button} onPress={onErrorButton} />
        ) : (
          <>
            <TextLink label={copy.connect.view_course} onPress={() => navigation.navigate('CourseHome')} />
            <BigButton label={copy.connect.button} disabled={!canSubmit(code) || busy} onPress={submit} />
          </>
        )
      }>
      <AssetPlaceholder name="sun-happy" width={160} height={88} />
      <Text20 size={24}>{copy.connect.greeting}</Text20>
      <Text20 size={28} weight="bold">{copy.connect.title}</Text20>
      <Text20>{copy.connect.hint}</Text20>
      <View style={styles.gap} />
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </View>
      ) : (
        <CodeEntry value={code} onChange={setCode} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({gap: {height: 12}});
