import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {StepRow} from '../../ui/StepRow';
import {color, radius} from '../../ui/tokens';
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
      <Screen top={<Title />} bottom={<BigButton label={syncError.button} onPress={sync} />}>
        <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{syncError.title}</Text20>
        <Text20>{syncError.body}</Text20>
      </Screen>
    );
  }
  if (content === undefined) {
    return (
      <Screen top={<Title />}>
        <Text20 size={24}>{appCopy.loading}</Text20>
      </Screen>
    );
  }
  if (content === null || !content.photo || !content.question) {
    return (
      <Screen top={<Title />} bottom={<BigButton variant="secondary" label={appCopy.no_content.button} onPress={sync} />}>
        <Text20 size={24} weight="bold">{appCopy.no_content.title}</Text20>
        <Text20>{appCopy.no_content.body}</Text20>
      </Screen>
    );
  }
  const preview = !content.linked;
  const all = done.length === 3;
  const current = STEPS.find(s => !done.includes(s.step));
  // 표준 화면 틀: 제목은 위 고정, 단계는 누르지 않는 행, 지금 할 단계로 가는 큰 버튼 1개만 아래 고정(글자를 키우면 본문만 스크롤)
  const dock = current ? (
    <BigButton label={c.step[current.step]} onPress={() => navigation.navigate(current.route)} />
  ) : undefined;
  return (
    <Screen top={<Title />} bottom={dock}>
      {preview ? (
        <View style={styles.notice}>
          <Text20 weight="bold">{c.disconnected_banner}</Text20>
          <BigButton variant="secondary" label={c.write_code} onPress={() => navigation.popTo('Connect')} />
        </View>
      ) : null}
      {syncError ? (
        <View style={styles.notice}>
          <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{syncError.title}</Text20>
          <BigButton variant="secondary" label={syncError.button} onPress={sync} />
        </View>
      ) : null}
      {all ? (
        <>
          <Text20 size={24} weight="bold">{copy.done.title}</Text20>
          <Text20>{copy.done.body}</Text20>
        </>
      ) : done.length === 0 ? (
        <Text20 size={24}>{c.greeting}</Text20>
      ) : null}
      {!consented && !preview ? (
        <View style={styles.notice}>
          <Text20>{copy.consent.title}</Text20>
          <BigButton variant="secondary" label={copy.consent.accept} onPress={consentNow} />
          {consentError ? <Text20 accessibilityLiveRegion="polite">{consentError.title}</Text20> : null}
        </View>
      ) : null}
      <View style={styles.steps}>
        {STEPS.map(s => {
          const status = done.includes(s.step) ? 'done' : current?.step === s.step ? 'now' : 'wait';
          const statusLabel = status === 'done' ? c.status.done : status === 'now' ? c.status.now : c.status.later;
          return <StepRow key={s.step} title={c.step[s.step]} status={status} statusLabel={statusLabel} />;
        })}
      </View>
      {preview ? null : (
        <BigButton variant="secondary" label={copy.settings.open} onPress={() => navigation.navigate('Settings')} />
      )}
    </Screen>
  );
}

function Title() {
  return (
    <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>
      {c.title}
    </Text20>
  );
}

const styles = StyleSheet.create({
  title: {paddingBottom: 8},
  steps: {gap: 12},
  notice: {backgroundColor: color.noticeSoft, borderRadius: radius.card, borderWidth: 4, borderColor: color.action, paddingVertical: 14, paddingHorizontal: 16, gap: 12},
});
