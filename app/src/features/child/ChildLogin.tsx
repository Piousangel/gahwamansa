import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, TextInput, useWindowDimensions, View} from 'react-native';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {BackBar} from '../../app/BackBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {color, radius} from '../../ui/tokens';
import {copy, offlineMessage} from '../../copy/copy';
import {hasReason, isOffline} from '../types';
import {OtpField} from './OtpField';
import {SocialButton} from './SocialButton';
import {TextLink} from '../link/TextLink';
import {useBusyLatch} from '../../ui/useBusyLatch';

const t = copy.login;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_WAIT_MS = 60 * 1000; // 다시 받기 대기(남용·연타 방지). 화면에는 숫자를 쓰지 않는다
const CODE_VALID_MS = 10 * 60 * 1000; // 메일 템플릿 기준 유효 10분

// 자녀 로그인: 이메일 -> 메일로 온 인증번호 6자리(Supabase OTP). 성공하면 시작 화면(ChildGate)부터 다시 정한다.
// 주 버튼은 하단 고정 영역(내비게이션 바 위), 보조는 그 안. 이전: 이메일 단계는 역할 선택, 번호 단계는 이메일 단계.
export function ChildLogin() {
  const navigation = useNavigation();
  const {api, resetRole} = useSession();
  const large = useWindowDimensions().fontScale >= 1.5; // 150% 이상이면 약관·연령 줄을 본문 끝으로(하단 고정을 지킨다)
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'choose' | 'email' | 'code'>('choose');
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [note, setNote] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const sentAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  }, []);

  const startCooldown = () => {
    setCanResend(false);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCanResend(true), RESEND_WAIT_MS);
  };

  const sendError = (e: unknown) =>
    hasReason(e, 'rate_limited')
      ? t.rate_limited
      : hasReason(e, 'invalid_email')
        ? t.bad_email
        : isOffline(e)
          ? offlineMessage.title
          : t.failed.title;

  const send = async (again: boolean) => {
    const addr = email.trim();
    if (!EMAIL_RE.test(addr)) {
      setNote(t.bad_email);
      return;
    }
    if (!beginBusy()) {
      return; // 보내는 중 두 번 누름(보낸 횟수 제한에 빨리 닿지 않게, 리뷰 M2)
    }
    setNote(null);
    try {
      await api.sendEmailCode(addr);
      sentAt.current = Date.now();
      setStage('code');
      setCode('');
      setNote(again ? t.resent : null);
      startCooldown();
    } catch (e) {
      setNote(sendError(e));
    } finally {
      endBusy();
    }
  };

  // 6자리를 채우면 자동 확인. 같은 번호로 두 번 부르지 않는다(진행 중이면 무시).
  const verifying = useRef(false);
  const onCode = (v: string) => {
    setCode(v);
    if (v.length === 6 && !verifying.current) {
      verify(v);
    }
  };

  const verify = async (value: string) => {
    if (!beginBusy()) {
      return;
    }
    verifying.current = true;
    setNote(null);
    try {
      await api.verifyEmailCode(email.trim(), value);
      navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Gate'}]}));
    } catch (e) {
      // 서버는 틀림과 만료를 같은 코드로 알려 준다. 보낸 지 10분이 지났으면 만료로 안내한다.
      const expired = Date.now() - sentAt.current > CODE_VALID_MS;
      setNote(
        hasReason(e, 'otp_expired') ? (expired ? t.expired : t.bad_code) : isOffline(e) ? offlineMessage.title : t.failed.title,
      );
      setCode('');
    } finally {
      verifying.current = false;
      endBusy();
    }
  };

  const toEmail = useCallback(() => {
    setStage('email');
    setNote(null);
  }, []);
  const noteView = note ? <Text20 accessibilityLiveRegion="polite">{note}</Text20> : null;

  // 소셜 로그인(카카오·구글): 네이티브 SDK → Supabase. 취소는 조용히, 인터넷 문제·그 밖의 실패는 문구로.
  const social = async (provider: 'kakao' | 'google') => {
    if (!beginBusy()) {
      return;
    }
    setNote(null);
    try {
      const r = await api.signInWithSocial(provider);
      if (r === 'ok') {
        navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Gate'}]}));
      }
    } catch (e) {
      setNote(hasReason(e, 'parent_device') ? t.blocked_parent_device.title : isOffline(e) ? offlineMessage.title : t.failed.title);
    } finally {
      endBusy();
    }
  };
  const toChoose = useCallback(() => {
    setStage('choose');
    setNote(null);
  }, []);

  // 약관 줄 + 연령 줄(디자인 판정 ②: 연령은 안내라 inkSub). 선택·이메일 두 화면에 같게
  const legalLines = (
    <View>
      <Text20 testID="legal-child" style={styles.legal}>{copy.legal.agree_child}</Text20>
      <Text20 testID="age-notice" style={[styles.legal, styles.age]}>{copy.legal.age_notice}</Text20>
    </View>
  );

  if (stage === 'choose') {
    // 시안 C0 "카카오로 시작해요": 카카오(주) → 구글 → 이메일로 받기(보조 링크). 이전은 역할 선택
    return (
      <Screen
        top={<BackBar onBack={resetRole} />}
        bottom={
          <>
            <SocialButton kind="kakao" label={busy ? t.signing_in : t.kakao} disabled={busy} onPress={() => social('kakao')} />
            <SocialButton kind="google" label={t.google} disabled={busy} onPress={() => social('google')} />
            {/* 시안 C0: 소셜 버튼 → 약관 줄 → 연령 줄(디자인 판정 11-18 ②) → 이메일 링크. 150% 이상이면 두 줄은 본문 끝으로 */}
            {large ? null : legalLines}
            <TextLink label={t.email_link} disabled={busy} onPress={toEmail} />
          </>
        }>
        <Text20 size={28} weight="bold">{t.choose_title}</Text20>
        <Text20>{t.hint}</Text20>
        {busy ? <Text20 accessibilityLiveRegion="polite">{t.signing_in}</Text20> : null}
        {note ? (
          <>
            <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{note}</Text20>
            {note === t.failed.title ? <Text20>{t.failed.body}</Text20> : null}
          </>
        ) : null}
        {large ? legalLines : null}
      </Screen>
    );
  }

  if (stage === 'email') {
    return (
      <Screen
        top={<BackBar onBack={toChoose} />}
        bottom={
          <>
            <BigButton label={t.send} disabled={busy} onPress={() => send(false)} />
            {large ? null : legalLines}
          </>
        }>
        <Text20 size={28} weight="bold">{t.title}</Text20>
        <Text20>{t.hint}</Text20>
        <TextInput
          accessibilityLabel={t.email_label}
          placeholder={t.email_placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          style={styles.input}
        />
        {noteView}
        {large ? legalLines : null}
      </Screen>
    );
  }
  return (
    <Screen
      top={<BackBar onBack={toEmail} />}
      bottom={
        <>
          <TextLink label={t.resend} disabled={busy || !canResend} onPress={() => send(true)} />
          <TextLink label={t.other_email} onPress={toEmail} />
        </>
      }>
      <Text20 size={26} weight="bold">{t.code_title}</Text20>
      <Text20>{t.sent.split('{이메일}').join(email.trim())}</Text20>
      <OtpField value={code} onChange={onCode} />
      <Text20 accessibilityLiveRegion="polite">{busy ? t.checking : t.code_auto_hint}</Text20>
      <Text20>{t.code_valid}</Text20>
      <Text20>{t.code_hint}</Text20>
      {noteView}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legal: {textAlign: 'center', color: color.ink, marginVertical: 4},
  age: {color: color.inkSub},
  input: {minHeight: 64, fontSize: 22, borderBottomWidth: 4, borderColor: color.action, borderRadius: radius.input, backgroundColor: color.paperSoft, paddingHorizontal: 12, marginVertical: 12, color: color.ink},
});
