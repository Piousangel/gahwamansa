import React, {useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {tempCopy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';

const t = tempCopy.settings;

// 어르신 설정: 동의 상태에 따라 "다시 동의하기"가 "동의 철회" 자리를 대신한다. 지우기는 여기서 들어간다.
export function ParentSettings() {
  const navigation = useNavigation();
  const {api, consented, applyConsent, applyWithdraw} = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Message | null>(null);

  const run = async (action: () => Promise<void>, done: () => void) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
      done();
      setConfirming(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text20 size={24} weight="bold">{consented ? t.sharedNow : t.notSharedNow}</Text20>
      {consented ? (
        confirming ? (
          <>
            <Text20 size={26} weight="bold">{t.withdrawWarn}</Text20>
            <BigButton label={t.withdrawYes} disabled={busy} onPress={() => run(() => api.withdrawConsent(), applyWithdraw)} />
          </>
        ) : (
          <BigButton variant="secondary" label={t.withdraw} onPress={() => setConfirming(true)} />
        )
      ) : (
        <BigButton label={t.reconsent} disabled={busy} onPress={() => run(() => api.giveConsent(), applyConsent)} />
      )}
      {error ? (
        <>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </>
      ) : null}
      <BigButton variant="secondary" label={t.deleteData} onPress={() => navigation.navigate('DeleteAccount' as never)} />
      <BigButton variant="secondary" label={t.back} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
