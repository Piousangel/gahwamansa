import React, {useEffect, useState} from 'react';
import {Share, StyleSheet, View} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {AudienceProvider, Banner, Button, Card, DsScreen, Heading, Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {copyText} from '../../ui/clipboard';
import {useToast} from '../../ui/Toast';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {formatCode} from '../../ui/codeInputLogic';
import {useBootLoading} from '../../app/splash';
import {childErrorMessage} from '../../shared/childError';
import {buildShareMessage, codeA11y, formatExpiry} from '../../lib/childFormat';
import {appShareLink} from '../../lib/env';
import {useNotifyPermission} from './useNotifyPermission';
import {useChildWaitState} from './useChildWaitState';
import {track} from '../track';

const w = copy.child.wait;

/** 위 영역: 제목 '연결 기다리는 중' + 설정 링크. 줄이 모자라면(200%) 설정이 제목 아래 줄로 내려간다(시안 C3 v4) */
function WaitHeader({onSettings}: {onSettings: () => void}) {
  return (
    <View style={styles.head}>
      <Heading level={1} style={styles.headTitle}>
        {w.chip}
      </Heading>
      <Button kind="text" size="inline" label={copy.settings.open} onPress={onSettings} testID="wait-settings" />
    </View>
  );
}

// C3 연결 기다리는 중 v4(시안 child/C3_C4_P8_ds4 #42, UX V9): 번호 카드가 맨 위(번호·기한·알림 켜기) → 부모님 폰 3단계.
// Dock = 주 '번호 보내기' + 보조 '복사하기'(200%에서 넘치면 복사하기는 본문 끝). 연결 칩·예시 카드 없음.
// 만료 전에는 새 번호 만들기 없음(받으면 이미 보낸 번호가 무효). 만료되면 안내 띠 + '새 번호 만들기'.
// BackLink 없음: 가입 단계의 끝이라 되돌아갈 곳이 없다(R-14 예외 목록, 시안 주석).
export function ChildWaitScreen({navigation}: NativeStackScreenProps<ChildParams, 'Wait'>) {
  const {api} = useSession();
  const {state, error, setError, check} = useChildWaitState(api);
  const [busy, setBusy] = useState(false);
  const [renewed, setRenewed] = useState(false); // 이 화면에서 지난 번호 대신 새 번호를 만들었다
  // UX U12: 공유 창에서 돌아오면 안내 한 줄, 주 버튼은 '다시 보내기'로(새 번호를 또 만들지 않게)
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(0); // 감사 L2: 번호 카드 위 '복사했어요' 띠(2초)
  useEffect(() => {
    if (!copied) {
      return;
    }
    const t = setTimeout(() => setCopied(0), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const {show} = useToast();
  const notify = useNotifyPermission();
  useBootLoading(!state && !error); // 앱 시작 중이면 스플래시 대기 화면이 덮는다
  const linked = !!state?.linked;

  const title = state?.parentTitle ?? '부모님';
  const code = state?.code ?? null;

  // 쓸 수 있는 번호가 없을 때만 새로 만든다(만료·받은 적 없음)
  const makeCode = async () => {
    if (!state || code || busy) {
      return;
    }
    setBusy(true);
    try {
      await api.issueInviteCode();
      track(api, 'invite_code_issued', {purpose: 'parent_code'}); // AC-05
      if (state.hadExpired) {
        setRenewed(true);
        show({text: w.renewed});
      }
      await check(true); // 새 번호를 바로 반영(진행 중인 확인과 겹쳐도 같은 상태로 끝난다)
    } catch (e) {
      setError(childErrorMessage(e, copy.errors.server));
    } finally {
      setBusy(false);
    }
  };
  const send = () => {
    if (code) {
      track(api, 'invite_share_tapped', {channel: 'share_sheet'}); // AC-05: Android 는 어느 앱으로 보냈는지 알 수 없다
      Share.share({message: buildShareMessage(copy.code.share, copy.safe.money, code.code, formatExpiry(code.expiresAt), appShareLink(code.code))})
        .then(r => {
          if (r?.action !== Share.dismissedAction) {
            setSent(true); // 공유 창에서 돌아왔다(Android 는 보냈는지 알 수 없어 돌아온 것을 기준으로)
          }
        })
        .catch(() => {});
    }
  };
  const copyCode = () => {
    if (code && copyText(code.code)) {
      track(api, 'invite_share_tapped', {channel: 'copy'}); // AC-05
      setCopied(n => n + 1);
    }
  };
  const settings = () => navigation.navigate('Settings');

  if (linked) {
    const d = copy.connect_done;
    return (
      <AudienceProvider value="child">
        <DsScreen
          variant="step"
          header={<Heading level={1}>{d.title}</Heading>}
          dock={{primary: {label: d.button, onPress: () => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Tabs'}]}))}}}>
          {d.body.map(l => (
            <Text key={l} role="bodyLg">
              {withTitle(l, title)}
            </Text>
          ))}
        </DsScreen>
      </AudienceProvider>
    );
  }

  const expired = !!state && !code && state.hadExpired;
  const dock: DockProps = !state
    ? {primary: {label: w.send, onPress: () => {}, disabled: true}}
    : code
      ? {
          primary: sent ? {kind: 'primary', label: w.resend, onPress: send} : {label: w.send, onPress: send},
          secondary: {kind: 'text', label: w.copy, onPress: copyCode, testID: 'wait-copy'},
        }
      : {primary: {label: expired ? w.new_code : w.make_code, loading: busy, onPress: makeCode}};
  const until = code ? w.until.split('{시각}').join(formatExpiry(code.expiresAt)) : '';

  return (
    <AudienceProvider value="child">
      <DsScreen variant="step" header={<WaitHeader onSettings={settings} />} dock={dock}>
        {!state ? <Text role="body">{appCopy.loading}</Text> : null}
        {expired ? (
          <Card tone="notice" testID="wait-expired">
            <Heading level={2}>{w.expired_title}</Heading>
            <Text role="body">{w.expired_body}</Text>
            {/* 11-9: 누르기 전에 앞 번호가 무효가 된다는 것을 알림 */}
            <Text role="sub" tone="muted">
              {w.new_code_note}
            </Text>
          </Card>
        ) : null}
        {copied ? <Banner testID="wait-copied" tone="done" text={w.copied} /> : null}
        {code ? (
          <Card testID="wait-code">
            <Text role="body">{w.code_label}</Text>
            {/* 리뷰 L6: 번호와 기한을 한 덩어리로 읽는다(복사하기는 Dock) */}
            <View accessible accessibilityLabel={`${copy.code.show_a11y.split('{앞}, {뒤}').join(codeA11y(code.code))}, ${until}`} style={styles.group}>
              <Text role="display" testID="wait-code-number">
                {formatCode(code.code)}
              </Text>
              <Text role="sub" tone="muted">
                {until}
              </Text>
            </View>
            {renewed ? <Text role="body">{copy.code.old_invalid}</Text> : null}
            {/* UX U12(11-9): 공유 창에서 돌아오면 안내 한 줄(보냈는지는 앱이 알 수 없어 단정하지 않음) */}
            {sent ? (
              <Text role="body" testID="wait-after-share">
                {w.after_share}
              </Text>
            ) : null}
            {/* V9: 알림 켜기는 번호 카드 안(이미 켜졌으면 줄 없음) */}
            {notify.denied ? (
              <View testID="wait-notify" style={styles.notify}>
                <Text role="sub" tone="muted">
                  {w.notify}
                </Text>
                <Button kind="text" size="inline" label={w.notify_button} onPress={notify.open} />
              </View>
            ) : null}
          </Card>
        ) : null}
        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.group}>
            <Text role="body">{error.title}</Text>
            <Button kind="secondary" size="dock" label={error.button} onPress={() => check()} />
          </View>
        ) : null}
        {expired ? null : (
          <View style={styles.steps} testID="wait-steps">
            <Heading level={2}>{w.steps_title}</Heading>
            {w.steps.map((s, i) => (
              <View key={s} style={styles.step}>
                <View style={styles.num} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text role="body">{String(i + 1)}</Text>
                </View>
                <Text role="body" style={styles.stepText}>
                  {withTitle(s, title)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </DsScreen>
    </AudienceProvider>
  );
}

const styles = StyleSheet.create({
  head: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12},
  headTitle: {flexShrink: 1},
  group: {gap: 4, alignSelf: 'stretch'},
  notify: {gap: 4, borderTopWidth: 1.5, borderTopColor: ds.color.lineSoft, paddingTop: 10, alignSelf: 'stretch'},
  steps: {gap: 12, alignSelf: 'stretch'},
  step: {flexDirection: 'row', gap: 12, alignItems: 'flex-start'},
  // 번호 원: 글자가 커지면 같이 커지게 최소 크기만(고정 상자 없음)
  num: {minWidth: 32, minHeight: 32, borderRadius: 16, paddingHorizontal: 6, backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, alignItems: 'center', justifyContent: 'center'},
  stepText: {flex: 1},
});
