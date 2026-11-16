import React, {useEffect, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';

export function ConsentScreen({navigation}: NativeStackScreenProps<ParentParams, 'Consent'>) {
  const {api, refresh, applyConsent} = useSession();
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Message | null>(null);

  // 서버가 이미 동의한 상태면 이 화면을 건너뛴다(서버 상태와 어긋나는 '싫어요'를 막는다).
  useEffect(() => {
    let alive = true;
    refresh()
      .then(c => {
        if (alive && c?.consented) {
          navigation.navigate('CourseHome');
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refresh, navigation]);

  const accept = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.giveConsent();
      applyConsent();
      navigation.navigate('CourseHome');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  // 거부: 서버 호출 없음. 코스는 볼 수 있고 답변은 저장하지 않는다. 나중에 코스 홈에서 동의할 수 있다.
  const decline = () => setDeclined(true);

  if (declined) {
    return (
      <Screen>
        <Text20 size={28} weight="bold">{copy.consent.declined_notice}</Text20>
        <Text20>{copy.consent.declined_detail}</Text20>
        <BigButton label="알겠어요" onPress={() => navigation.navigate('CourseHome')} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text20 size={30} weight="bold">{copy.consent.title}</Text20>
      {copy.consent.body.map(t => (
        <Text20 key={t} size={22}>{t}</Text20>
      ))}
      <Text20>{copy.consent.reassure}</Text20>
      {error ? (
        <>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </>
      ) : null}
      <BigButton label={copy.consent.accept} disabled={busy} onPress={accept} />
      <BigButton variant="secondary" label={copy.consent.decline} onPress={decline} />
    </Screen>
  );
}
