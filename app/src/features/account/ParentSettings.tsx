import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius} from '../../ui/tokens';
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

  // 표준 화면 틀: 설정 내용은 본문(스크롤), "돌아가기"만 하단 고정.
  return (
    <Screen
      top={
        <>
          <BackBar />
          <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>
            {copy.settings.open}
          </Text20>
        </>
      }
      bottom={<BigButton variant="secondary" label={t.back} onPress={() => navigation.goBack()} />}>
      <View style={styles.section}>
        <Text20 size={24} weight="bold">{t.share_row}</Text20>
        <Text20>{consented ? t.shared_now : t.not_shared_now}</Text20>
        {notice ? <Text20 accessibilityLiveRegion="polite">{notice}</Text20> : null}
        {confirm === 'stop' ? (
          <View style={styles.confirm}>
            <Text20 size={26} weight="bold">{t.stop_title}</Text20>
            <Text20>{t.stop_body}</Text20>
            <BigButton label={t.keep} onPress={() => setConfirm('none')} />
            <BigButton variant="secondary" label={t.stop} loading={busy} onPress={() => run(() => api.withdrawConsent(), false, t.stopped)} />
          </View>
        ) : confirm === 'resume' ? (
          <View style={styles.confirm}>
            <Text20 size={26} weight="bold">{t.resume_confirm}</Text20>
            <BigButton label={t.resume_yes} loading={busy} onPress={() => run(() => api.giveConsent(CONSENT_VERSION), true, null)} />
            <BigButton variant="secondary" label={t.keep} onPress={() => setConfirm('none')} />
          </View>
        ) : consented ? (
          <BigButton variant="secondary" label={t.stop} onPress={() => setConfirm('stop')} />
        ) : (
          <BigButton label={t.resume} onPress={() => setConfirm('resume')} />
        )}
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text20 size={24} weight="bold" style={styles.errorTitle}>{error.title}</Text20>
            <Text20>{error.body}</Text20>
          </View>
        ) : null}
      </View>
      <View style={styles.section}>
        <BigButton variant="danger" label={t.delete_row} onPress={() => navigation.navigate('DeleteAccount')} />
        <Text20 style={styles.sub}>{t.delete_hint}</Text20>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {paddingBottom: 8},
  section: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 16, gap: 12},
  confirm: {backgroundColor: color.noticeSoft, borderRadius: radius.card, borderWidth: 4, borderColor: color.action, padding: 14, gap: 12},
  error: {backgroundColor: color.dangerSoft, borderRadius: radius.card, borderWidth: 3, borderColor: color.dangerInk, paddingVertical: 10, paddingHorizontal: 16, gap: 4},
  errorTitle: {color: color.dangerInk},
  sub: {color: color.inkSub},
});
