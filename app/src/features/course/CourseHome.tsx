import React, {useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, copy, offlineMessage} from '../../copy/copy';
import {useLoadTodayContent} from './useTodayContent';
import type {StepName} from '../types';

const STEPS: {step: StepName; label: string; route: 'PhotoStep' | 'QuestionStep' | 'HangulStep'}[] = [
  {step: 'photo', label: '사진 보기', route: 'PhotoStep'},
  {step: 'question', label: '질문 고르기', route: 'QuestionStep'},
  {step: 'hangul', label: '글씨 쓰기', route: 'HangulStep'},
];

export function CourseHome({navigation}: NativeStackScreenProps<ParentParams, 'CourseHome'>) {
  const {api, done, streak, content, consented, applyConsent} = useSession();
  const [consentError, setConsentError] = useState(false);
  const {failed, retry} = useLoadTodayContent();
  const all = done.length === 3;
  const consentNow = async () => {
    setConsentError(false);
    try {
      await api.giveConsent();
      applyConsent();
    } catch {
      setConsentError(true);
    }
  };
  const current = STEPS.find(s => !done.includes(s.step));
  if (failed) {
    return (
      <Screen>
        <Text20 size={30} weight="bold">오늘의 코스</Text20>
        <Text20 size={24} weight="bold">{offlineMessage.title}</Text20>
        <Text20>{offlineMessage.body}</Text20>
        <BigButton variant="secondary" label={offlineMessage.button} onPress={retry} />
      </Screen>
    );
  }
  if (content === undefined) {
    return (
      <Screen>
        <Text20 size={30} weight="bold">오늘의 코스</Text20>
        <Text20>{appCopy.loading}</Text20>
      </Screen>
    );
  }
  if (content === null || !content.photo || !content.question) {
    return (
      <Screen>
        <Text20 size={30} weight="bold">오늘의 코스</Text20>
        <Text20 size={24} weight="bold">{appCopy.no_content.title}</Text20>
        <Text20>{appCopy.no_content.body}</Text20>
        <BigButton variant="secondary" label={appCopy.no_content.button} onPress={retry} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text20 size={30} weight="bold">오늘의 코스</Text20>
      {all ? (
        <>
          <Text20 size={24}>{copy.praise[0]}</Text20>
          <Text20>{`${streak}일 연속 해냈어요`}</Text20>
          <Text20>{appCopy.course_done_today}</Text20>
        </>
      ) : null}
      {!consented ? (
        <>
          <Text20>{copy.consent.title}</Text20>
          <BigButton variant="secondary" label={copy.consent.accept} onPress={consentNow} />
          {consentError ? <Text20>{offlineMessage.title}</Text20> : null}
        </>
      ) : null}
      {STEPS.map(s => {
        const isDone = done.includes(s.step);
        const isNow = current?.step === s.step;
        if (isDone) return <Text20 key={s.step} size={24}>{`${s.label} - 했어요`}</Text20>;
        if (isNow) {
          return (
            <BigButton key={s.step} label={`${s.label} (지금 할 차례)`} onPress={() => navigation.navigate(s.route)} />
          );
        }
        return <Text20 key={s.step} size={24}>{`${s.label} - 기다려요`}</Text20>;
      })}
    </Screen>
  );
}
