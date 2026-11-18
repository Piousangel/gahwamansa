import React, {useEffect, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';
import {useBusyLatch} from '../../ui/useBusyLatch';

export function ConsentScreen({navigation}: NativeStackScreenProps<ParentParams, 'Consent'>) {
  const {api, sync, syncError, setConsented} = useSession();
  const [declined, setDeclined] = useState(false);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [error, setError] = useState<Message | null>(null);

  // 동의 화면은 코스 홈으로 바뀐다(replace): 뒤로가기로 동의 화면이 다시 나오지 않게(리뷰 ③)
  // 서버가 이미 동의한 상태면 이 화면을 건너뛴다(서버 상태와 어긋나는 '싫어요'를 막는다).
  // 확인이 실패하면 세션의 syncError 로 알리되 고르기는 그대로 할 수 있다.
  useEffect(() => {
    let alive = true;
    sync().then(c => {
      if (alive && c?.consented) {
        navigation.replace('CourseHome');
      }
    });
    return () => {
      alive = false;
    };
  }, [sync, navigation]);

  const shown = error ?? syncError; // 동의 저장 실패가 우선, 없으면 상태 확인 실패
  const accept = async () => {
    if (!beginBusy()) {
      return;
    }
    setError(null);
    try {
      await api.giveConsent(CONSENT_VERSION);
      setConsented(true);
      navigation.replace('CourseHome');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      endBusy();
    }
  };
  // 거부: 서버 호출 없음. 코스는 볼 수 있고 답변은 저장하지 않는다. 나중에 코스 홈에서 동의할 수 있다.
  const decline = () => setDeclined(true);

  if (declined) {
    return (
      <Screen bottom={<BigButton label={copy.consent.declined_button} onPress={() => navigation.replace('CourseHome')} />}>
        <Text20 size={28} weight="bold">{copy.consent.declined_notice}</Text20>
        <Text20>{copy.consent.declined_detail}</Text20>
        <Text20>{copy.consent.declined_reassure}</Text20>
      </Screen>
    );
  }
  return (
    <Screen
      top={<BackBar />}
      bottom={
        <>
          <BigButton label={copy.consent.accept} disabled={busy} onPress={accept} />
          <BigButton variant="secondary" label={copy.consent.decline} onPress={decline} />
        </>
      }>
      <Text20 size={30} weight="bold">{copy.consent.title}</Text20>
      {copy.consent.body.map(t => (
        <Text20 key={t} size={22}>{t}</Text20>
      ))}
      <Text20>{copy.consent.reassure}</Text20>
      {shown ? (
        <>
          <Text20 size={24} weight="bold">{shown.title}</Text20>
          <Text20>{shown.body}</Text20>
        </>
      ) : null}
    </Screen>
  );
}
