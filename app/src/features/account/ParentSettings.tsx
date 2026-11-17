import React, {useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';

const t = copy.settings;
type Confirm = 'none' | 'stop' | 'resume';

// 어르신 설정(P13): 가족에게 답 보여 주기(그만 보여 주기 / 다시 보여 주기, 각각 확인 1단계), 모두 지우기.
export function ParentSettings() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentParams>>();
  const {api, consented, setConsented} = useSession();
  const [confirm, setConfirm] = useState<Confirm>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Message | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, next: boolean, done: string | null) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
      setConsented(next);
      setConfirm('none');
      setNotice(done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text20 size={24} weight="bold">{t.share_row}</Text20>
      <Text20>{consented ? t.shared_now : t.not_shared_now}</Text20>
      {notice ? <Text20 accessibilityLiveRegion="polite">{notice}</Text20> : null}
      {confirm === 'stop' ? (
        <>
          <Text20 size={26} weight="bold">{t.stop_title}</Text20>
          <Text20>{t.stop_body}</Text20>
          <BigButton label={t.keep} onPress={() => setConfirm('none')} />
          <BigButton variant="secondary" label={t.stop} disabled={busy} onPress={() => run(() => api.withdrawConsent(), false, t.stopped)} />
        </>
      ) : confirm === 'resume' ? (
        <>
          <Text20 size={26} weight="bold">{t.resume_confirm}</Text20>
          <BigButton label={t.resume_yes} disabled={busy} onPress={() => run(() => api.giveConsent(CONSENT_VERSION), true, null)} />
          <BigButton variant="secondary" label={t.keep} onPress={() => setConfirm('none')} />
        </>
      ) : consented ? (
        <BigButton variant="secondary" label={t.stop} onPress={() => setConfirm('stop')} />
      ) : (
        <BigButton label={t.resume} onPress={() => setConfirm('resume')} />
      )}
      {error ? (
        <>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </>
      ) : null}
      <BigButton variant="secondary" label={t.delete_row} onPress={() => navigation.navigate('DeleteAccount')} />
      <Text20>{t.delete_hint}</Text20>
      <BigButton variant="secondary" label={t.back} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
