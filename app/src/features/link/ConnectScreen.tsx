import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CodeInput} from '../../ui/CodeInput';
import {AssetPlaceholder} from '../../ui/assets/AssetPlaceholder';
import {canSubmit, clearAll, deleteOne, inputDigit} from '../../ui/codeInputLogic';
import {copy, offlineMessage, reasonToMessage, Message} from '../../copy/copy';

export function ConnectScreen({navigation}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api} = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.redeemInviteCode(code);
      if (res.ok) {
        navigation.navigate('Consent');
      } else {
        setError(reasonToMessage(res.reason));
        if (res.reason === 'invalid') setCode('');
      }
    } catch {
      setError(offlineMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AssetPlaceholder name="sun-happy" width={160} height={88} />
      <Text20 size={24}>{copy.connect.greeting}</Text20>
      <Text20 size={28} weight="bold">{copy.connect.title}</Text20>
      <Text20>{copy.connect.hint}</Text20>
      <View style={styles.gap} />
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
          <BigButton variant="secondary" label={error.button} onPress={() => setError(null)} />
        </View>
      ) : (
        <>
          <CodeInput
            value={code}
            onDigit={d => setCode(c => inputDigit(c, d))}
            onDelete={() => setCode(deleteOne)}
            onClear={() => setCode(clearAll())}
          />
          <BigButton label={copy.connect.button} disabled={!canSubmit(code) || busy} onPress={submit} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({gap: {height: 12}});
