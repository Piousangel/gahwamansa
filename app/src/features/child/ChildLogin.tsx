import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {CommonActions, useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSession} from '../../app/session';
import {useBackAction} from '../../app/BackBar';
import {AudienceProvider, Banner, Button, Card, DsScreen, Field, Heading, Text} from '../../ui/ds';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {copy, offlineMessage} from '../../copy/copy';
import {hasReason, isOffline} from '../types';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {track} from '../track';
import {LegalText} from '../../ui/LegalText';
import {legalLinks, useLegalOpen} from '../../shared/legalLinks';
import {recordChildTerms} from '../../shared/childTerms';
import {announce} from '../../ui/a11y';

const t = copy.login;
// 시안 C0 v4: '이런 앱이에요' 카드는 키가 큰 화면(760 이상)에서만, 브랜드 심볼·카드는 글자 150% 이상이면 숨긴다
const PREVIEW_MIN_H = 760;
const RESEND_WAIT_MS = 60 * 1000; // 다시 받기 대기(남용·연타 방지). 화면에는 숫자를 쓰지 않는다
const CODE_VALID_MS = 10 * 60 * 1000; // 메일 템플릿 기준 유효 10분

// 로그인 스택 경로(ChildStack ChildParams 와 같은 모양, features 는 app/ 를 import 하지 않는다)
type LoginParams = {Login: undefined; LoginEmail: undefined; LoginCode: {email: string}};

// 약관 줄 + 연령 줄(본문 끝, 시안 C0 v4: sub 역할·보조색, 약관 링크 400 + 밑줄). C0-a·C0-b 공통
export function LegalAndAge({legal}: {legal: ReturnType<typeof useLegalOpen>}) {
  return (
    <View style={styles.group}>
      <LegalText testID="legal-child" audience="child" text={copy.legal.agree_child} links={legalLinks()} onOpen={legal.open} />
      {legal.busy ? (
        <Text role="sub" tone="muted" testID="legal-busy">
          {copy.app.loading}
        </Text>
      ) : null}
      {legal.offline ? <Banner testID="legal-offline" tone="offline" text={copy.app_info.link_offline} /> : null}
      <Text role="sub" tone="muted" testID="age-notice">
        {copy.legal.age_notice}
      </Text>
    </View>
  );
}

/** 상태 한 줄(로그인 중·오류·안내): 글이 있을 때만 자리를 차지하고(빈 간격 없음, 시안 1:1), 바뀌면 한 번 읽어 준다 */
export function StatusLine({text, testID}: {text: string | null; testID?: string}) {
  useEffect(() => {
    if (text) {
      announce(text);
    }
  }, [text]);
  return text ? (
    <View testID={testID}>
      <Text role="body">{text}</Text>
    </View>
  ) : null;
}

// C0-a 로그인 고르기(시안 child/C0_login_ds4, form 틀, 로그인 스택 3화면 분리 Q9).
// Dock = 소셜 묶음(카카오·구글) + 보조 '이메일로 시작하기'. 본문: 심볼·제목·한 줄·(키 큰 화면) 카드·상태·약관·연령·부모님 출구.
// 200%에서 Dock 이 40%를 넘으면 DsScreen 이 이메일 링크를 본문 끝으로 보낸다.
export function ChildLogin() {
  const navigation = useNavigation<NativeStackNavigationProp<LoginParams>>();
  const legal = useLegalOpen();
  const {api, resetRole} = useSession();
  useBackAction(resetRole);
  const {height, fontScale} = useWindowDimensions();
  const big = fontScale >= 1.5;
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [note, setNote] = useState<string | null>(null);

  // 소셜 로그인(카카오·구글): 네이티브 SDK → Supabase. 취소는 조용히, 인터넷 문제·그 밖의 실패는 문구로.
  const social = async (provider: 'kakao' | 'google') => {
    if (!beginBusy()) {
      return;
    }
    setNote(null);
    try {
      const r = await api.signInWithSocial(provider);
      if (r === 'ok') {
        recordChildTerms(api).catch(() => {}); // 약관 줄을 본 로그인 = 동의(기다리지 않음, PR1 리뷰 M1)
        track(api, 'child_signup_completed', {login_method: provider}); // AC-05(자녀 퍼널 2단계)
        navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Gate'}]}));
      }
    } catch (e) {
      setNote(hasReason(e, 'parent_device') ? t.blocked_parent_device.title : isOffline(e) ? offlineMessage.title : t.failed.title);
    } finally {
      endBusy();
    }
  };
  const toEmail = useCallback(() => navigation.navigate('LoginEmail'), [navigation]);
  const failed = note === t.failed.title;

  return (
    <AudienceProvider value="child">
      <DsScreen
        variant="form"
        back={{label: t.back, onPress: resetRole}}
        dock={{
          primary: {
            social: [
              {provider: 'kakao', label: busy ? t.signing_in : t.kakao, disabled: busy, onPress: () => social('kakao')},
              {provider: 'google', label: t.google, disabled: busy, onPress: () => social('google')},
            ],
          },
          secondary: {kind: 'text', label: t.email_link, disabled: busy, onPress: toEmail},
        }}
        tail={
          // 출구는 본문 맨 끝: 200%에서 Dock 에서 넘친 이메일 링크보다 아래(시안 C0 v4, 리드 결정 '출구는 본문 끝')
          <View style={styles.group}>
            <Text role="sub" tone="muted">
              {t.parent_exit_note}
            </Text>
            <Button kind="text" size="inline" label={t.parent_exit} onPress={resetRole} testID="parent-exit" />
          </View>
        }>
        {big ? null : <BrandSymbol size={48} />}
        <Heading level={1}>{t.choose_title}</Heading>
        <Text role="bodyLg">{t.hint}</Text>
        {!big && height >= PREVIEW_MIN_H ? (
          <Card tone="notice" testID="login-preview">
            <Text role="body">{t.preview_title}</Text>
            {t.preview_lines.map(line => (
              <Text key={line} role="sub" tone="muted">
                {line}
              </Text>
            ))}
          </Card>
        ) : null}
        <StatusLine testID="login-status" text={busy ? t.signing_in : note} />
        {failed ? <Text role="body">{t.failed.body}</Text> : null}
        <LegalAndAge legal={legal} />
      </DsScreen>
    </AudienceProvider>
  );
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 인증번호 보내기 실패 문구(이메일·인증번호 화면 공통) */
export const sendError = (e: unknown) =>
  hasReason(e, 'rate_limited') ? t.rate_limited : hasReason(e, 'invalid_email') ? t.bad_email : isOffline(e) ? offlineMessage.title : t.failed.title;

// C0-b 이메일(시안 child/C0_login_ds4, form 틀). BackLink '로그인으로'(라이터 묶음 2). Field '이메일 주소'(placeholder 없음) + Dock 주 버튼.
// 자판이 열리면 DsScreen 이 위 영역(제목·한 줄)을 접고 BackLink 한 줄만 남긴다.
export function ChildLoginEmail() {
  const navigation = useNavigation<NativeStackNavigationProp<LoginParams>>();
  const {api} = useSession();
  const legal = useLegalOpen();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch();

  const send = async () => {
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
      navigation.navigate('LoginCode', {email: addr});
    } catch (e) {
      setNote(sendError(e));
    } finally {
      endBusy();
    }
  };

  return (
    <AudienceProvider value="child">
      <DsScreen
        variant="form"
        dockReleaseOnKeyboard // R-12 예외: 200% 자판 열림에서 주 버튼이 40%를 넘으면 입력 바로 아래로(디자인 #74)
        back={{label: t.back_choose, onPress: () => navigation.goBack()}}
        header={
          <>
            <Heading level={1}>{t.title}</Heading>
            <Text role="bodyLg">{t.hint}</Text>
          </>
        }
        dock={{primary: {label: t.send, onPress: send, loading: busy}}}
        // 약관·연령은 tail: 200% 자판 열림에서 Dock 이 풀리면 주 버튼이 입력 바로 아래, 그 뒤에 약관(디자인 결정 PR #74)
        tail={<LegalAndAge legal={legal} />}>
        <Field label={t.email_label} kind="email" value={email} onChangeText={setEmail} onSubmitEditing={send} error={note ?? undefined} testID="email-field" />
      </DsScreen>
    </AudienceProvider>
  );
}

// C0-c 인증번호(시안 child/C0_login_ds4, form 틀, Dock 없음 — 6자리를 채우면 자동 확인).
// BackLink '이메일 주소로'(라이터 묶음 2). 칸 보이는 라벨 '인증번호', 읽기 이름 '인증번호 6자리'(login.code_label).
export function ChildLoginCode() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<LoginParams, 'LoginCode'>>();
  const email = params.email;
  const {api} = useSession();
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch();
  const sentAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifying = useRef(false);

  const startCooldown = () => {
    setCanResend(false);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCanResend(true), RESEND_WAIT_MS);
  };
  useEffect(() => {
    startCooldown();
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const verify = async (value: string) => {
    if (!beginBusy()) {
      return;
    }
    verifying.current = true;
    setNote(null);
    try {
      await api.verifyEmailCode(email, value);
      recordChildTerms(api).catch(() => {}); // 약관 줄을 본 로그인 = 동의(C0-a·C0-b 에서 봤다, 기다리지 않음)
      track(api, 'child_signup_completed', {login_method: 'email'}); // AC-05(자녀 퍼널 2단계)
      navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Gate'}]}));
    } catch (e) {
      // 서버는 틀림과 만료를 같은 코드로 알려 준다. 보낸 지 10분이 지났으면 만료로 안내한다.
      const expired = Date.now() - sentAt.current > CODE_VALID_MS;
      setNote(hasReason(e, 'otp_expired') ? (expired ? t.expired : t.bad_code) : isOffline(e) ? offlineMessage.title : t.failed.title);
      setCode('');
    } finally {
      verifying.current = false;
      endBusy();
    }
  };
  // 6자리를 채우면 자동 확인. 같은 번호로 두 번 부르지 않는다(진행 중이면 무시)
  const onCode = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !verifying.current) {
      verify(digits);
    }
  };
  const resend = async () => {
    if (!beginBusy()) {
      return;
    }
    setNote(null);
    try {
      await api.sendEmailCode(email);
      sentAt.current = Date.now();
      setCode('');
      setNote(t.resent);
      startCooldown();
    } catch (e) {
      setNote(sendError(e));
    } finally {
      endBusy();
    }
  };

  return (
    <AudienceProvider value="child">
      <DsScreen variant="form" back={{label: t.back_email, onPress: () => navigation.goBack()}} header={<Heading level={1}>{t.code_title}</Heading>}>
        <Text role="body">{t.sent.split('{이메일}').join(email)}</Text>
        <Field label={t.code_label_short} accessibilityLabel={t.code_label} kind="otp" value={code} onChangeText={onCode} maxLength={6} autoFocus testID="code-field" />
        <StatusLine testID="code-status" text={busy ? t.checking : note ?? t.code_auto_hint} />
        <View style={styles.group}>
          <Text role="sub" tone="muted">
            {t.code_valid}
          </Text>
          <Text role="sub" tone="muted">
            {t.code_hint}
          </Text>
        </View>
        <Button kind="text" size="inline" label={t.resend} disabled={busy || !canResend} onPress={resend} />
        <Button kind="text" size="inline" label={t.other_email} onPress={() => navigation.goBack()} />
      </DsScreen>
    </AudienceProvider>
  );
}

const styles = StyleSheet.create({
  group: {gap: 8, alignSelf: 'stretch'},
});
