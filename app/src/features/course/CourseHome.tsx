import React, {useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {useLoadTodayContent} from './useTodayContent';
import {errorMessage} from './useFinishStep';
import type {StepName} from '../types';

const c = copy.course;
const STEPS: {step: StepName; route: 'PhotoStep' | 'QuestionStep' | 'HangulStep'}[] = [
  {step: 'photo', route: 'PhotoStep'},
  {step: 'question', route: 'QuestionStep'},
  {step: 'hangul', route: 'HangulStep'},
];

export function CourseHome({navigation}: NativeStackScreenProps<ParentParams, 'CourseHome'>) {
  const {api, done, content, consented, setConsented, syncError, sync} = useSession();
  const [consentError, setConsentError] = useState<Message | null>(null);
  useLoadTodayContent();
  const consentNow = async () => {
    setConsentError(null);
    try {
      await api.giveConsent(CONSENT_VERSION);
      setConsented(true);
    } catch (e) {
      setConsentError(errorMessage(e));
    }
  };
  // 아직 아무것도 못 받았는데 실패: 오류만 보여 준다(오프라인/서버 오류 문구가 다름)
  if (content === undefined && syncError) {
    return (
      <Screen>
        <Text20 size={30} weight="bold">{c.title}</Text20>
        <Text20 size={24} weight="bold">{syncError.title}</Text20>
        <Text20>{syncError.body}</Text20>
        <BigButton variant="secondary" label={syncError.button} onPress={sync} />
      </Screen>
    );
  }
  if (content === undefined) {
    return (
      <Screen>
        <Text20 size={30} weight="bold">{c.title}</Text20>
        <Text20>{appCopy.loading}</Text20>
      </Screen>
    );
  }
  if (content === null || !content.photo || !content.question) {
    return (
      <Screen>
        <Text20 size={30} weight="bold">{c.title}</Text20>
        <Text20 size={24} weight="bold">{appCopy.no_content.title}</Text20>
        <Text20>{appCopy.no_content.body}</Text20>
        <BigButton variant="secondary" label={appCopy.no_content.button} onPress={sync} />
      </Screen>
    );
  }
  const preview = !content.linked;
  const all = done.length === 3;
  const current = STEPS.find(s => !done.includes(s.step));
  return (
    <Screen>
      {preview ? (
        <>
          <Text20 weight="bold">{c.disconnected_banner}</Text20>
          <BigButton variant="secondary" label={c.write_code} onPress={() => navigation.popTo('Connect')} />
        </>
      ) : null}
      <Text20 size={30} weight="bold">{c.title}</Text20>
      {syncError ? (
        <>
          <Text20 size={24} weight="bold">{syncError.title}</Text20>
          <BigButton variant="secondary" label={syncError.button} onPress={sync} />
        </>
      ) : null}
      {all ? (
        <>
          <Text20 size={24} weight="bold">{copy.done.title}</Text20>
          <Text20>{copy.done.body}</Text20>
        </>
      ) : done.length === 0 ? (
        <Text20>{c.greeting}</Text20>
      ) : null}
      {!consented && !preview ? (
        <>
          <Text20>{copy.consent.title}</Text20>
          <BigButton variant="secondary" label={copy.consent.accept} onPress={consentNow} />
          {consentError ? <Text20>{consentError.title}</Text20> : null}
        </>
      ) : null}
      {STEPS.map(s => {
        const label = c.step[s.step];
        if (done.includes(s.step)) {
          return <Text20 key={s.step} size={24}>{`${label} - ${c.status.done}`}</Text20>;
        }
        if (current?.step === s.step) {
          return <BigButton key={s.step} label={`${label} (${c.status.now})`} onPress={() => navigation.navigate(s.route)} />;
        }
        return <Text20 key={s.step} size={24}>{`${label} - ${c.status.later}`}</Text20>;
      })}
      {preview ? null : (
        <BigButton variant="secondary" label={copy.settings.open} onPress={() => navigation.navigate('Settings')} />
      )}
    </Screen>
  );
}
