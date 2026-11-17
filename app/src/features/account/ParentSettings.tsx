import React, {useEffect, useState} from 'react';
import {StyleSheet, Switch, View} from 'react-native';
import {prefs} from '../../lib/prefs';
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
  const {api, consented, setConsented, content} = useSession();
  const linked = !!content?.linked; // 미연결 열람(번호 전)에는 보여 주기·지우기 대신 번호 쓰기 안내(QA B3)
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
      {linked ? (
        <>
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
        {/* P16 연결된 가족(copy 11-3 settings.family_row): 누구와 연결됐는지 확인·그만두기 */}
        <View style={styles.section}>
          <BigButton variant="secondary" label={t.family_row} onPress={() => navigation.navigate('Family')} />
        </View>
        <View style={styles.section}>
          <BigButton variant="danger" label={t.delete_row} onPress={() => navigation.navigate('DeleteAccount')} />
          <Text20 style={styles.sub}>{t.delete_hint}</Text20>
        </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text20 size={24} weight="bold">{t.share_row}</Text20>
          <Text20>{copy.course.disconnected_banner}</Text20>
          <BigButton variant="secondary" label={copy.course.write_code} onPress={() => navigation.push('Connect', {from: 'course'})} />
        </View>
      )}
      <SfxRow />
      {/* 앱 정보: AI 그림 고지 1줄 */}
      <View style={styles.section}>
        <Text20 weight="bold">{t.app_info}</Text20>
        <Text20 style={styles.sub}>{t.ai_notice}</Text20>
      </View>
    </Screen>
  );
}

// 효과음(도장 소리) 토글(시안 P7_motion·P13, 기본 켜짐). 이 기기에만 저장(서버로 보내지 않음).
// 읽기(talkback R10): "효과음, 스위치, 켜짐, 도장을 찍을 때 짧은 소리". 행 전체 터치 64 이상.
function SfxRow() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    let alive = true;
    prefs()
      .sfxEnabled()
      .then(v => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  const change = (v: boolean) => {
    setOn(v);
    prefs().setSfxEnabled(v);
  };
  return (
    <View testID="sfx-row" style={[styles.section, styles.toggleRow]}>
      <View style={styles.toggleText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text20 size={24} weight="bold">{t.sfx}</Text20>
        <Text20 style={styles.sub}>{t.sfx_sub}</Text20>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={t.sfx}
        accessibilityHint={t.sfx_sub}
        accessibilityState={{checked: on}}
        value={on}
        onValueChange={change}
        trackColor={{false: color.lineSoft, true: color.done}}
        thumbColor={color.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {flexDirection: 'row', alignItems: 'center', minHeight: 64},
  toggleText: {flex: 1, gap: 4},
  title: {paddingBottom: 8},
  section: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 16, gap: 12},
  confirm: {backgroundColor: color.noticeSoft, borderRadius: radius.card, borderWidth: 4, borderColor: color.action, padding: 14, gap: 12},
  error: {backgroundColor: color.dangerSoft, borderRadius: radius.card, borderWidth: 3, borderColor: color.dangerInk, paddingVertical: 10, paddingHorizontal: 16, gap: 4},
  errorTitle: {color: color.dangerInk},
  sub: {color: color.inkSub},
});
