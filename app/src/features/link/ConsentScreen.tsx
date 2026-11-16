import React, {useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {copy} from '../../copy/copy';

export function ConsentScreen({navigation}: NativeStackScreenProps<ParentParams, 'Consent'>) {
  const {api, setConsented} = useSession();
  const [declined, setDeclined] = useState(false);

  const accept = async () => {
    await api.giveConsent();
    setConsented(true);
    navigation.navigate('CourseHome');
  };
  const decline = () => {
    // 거부: 서버 호출 없음. 코스는 볼 수 있고 답변은 저장하지 않는다.
    setConsented(false);
    setDeclined(true);
  };

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
      <BigButton label={copy.consent.accept} onPress={accept} />
      <BigButton variant="secondary" label={copy.consent.decline} onPress={decline} />
    </Screen>
  );
}
