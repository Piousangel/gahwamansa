import React, {useEffect, useRef, useState} from 'react';
import {Share, StyleSheet, useWindowDimensions, View} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {AudienceProvider, Banner, Button, Card, DsScreen, Heading, Text, type DockProps} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {useFoldGap} from '../../ui/ds/useFoldGap';
import {copyText} from '../../ui/clipboard';
import {useToast} from '../../ui/Toast';
import {announce} from '../../ui/a11y';
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
  // 디자인 결정(PR #83 ②): 큰 글자(150% 이상)에서는 Dock = 주 버튼 하나, '복사하기'·알림 줄은 본문으로(번호 카드가 첫 화면에 통째로, R-15)
  const big = useWindowDimensions().fontScale >= 1.5;
  // 접힘 경계 맞춤(R-15, 디자인 결정 ③): 3단계 제목·행 중 첫 화면 끝에 걸치는 요소를 통째로 민다(ui/ds useFoldGap)
  const fold = useFoldGap(4, STEPS_GAP, 0, STEPS_GLUE);
  // PR #83 리뷰 M1: 보는 중에 번호가 만료돼 카드가 띠로 바뀌면 한 번 읽어 준다(v3 live region 대신 R11 '나타날 때 한 번')
  const expiredNow = !!state && !code && state.hadExpired;
  //   재확인 L7: 처음 열 때부터 만료면 화면 제목 읽기와 겹치므로 알리지 않는다(번호 카드를 보던 중 바뀔 때만)
  const hadCode = useRef(false);
  useEffect(() => {
    if (code) {
      hadCode.current = true;
    }
  }, [code]);
  useEffect(() => {
    if (expiredNow && hadCode.current) {
      announce(`${w.expired_title}. ${w.expired_body}`);
    }
  }, [expiredNow]);
  // 리뷰 L1: 공유 창에서 돌아오면 안내 줄도 한 번 읽어 준다
  useEffect(() => {
    if (sent) {
      announce(w.after_share);
    }
  }, [sent]);

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
  const copyLink = code && big ? <Button kind="text" size="dock" label={w.copy} onPress={copyCode} testID="wait-copy" /> : null;
  const notifyRow = notify.denied ? (
    <View testID="wait-notify" style={big ? styles.notifyOut : styles.notify}>
      <Text role="sub" tone="muted">
        {w.notify}
      </Text>
      <Button kind="text" size="inline" label={w.notify_button} onPress={notify.open} />
    </View>
  ) : null;
  const dock: DockProps = !state
    ? {primary: {label: w.send, onPress: () => {}, loading: true, loadingLabel: appCopy.loading}} // 리뷰 L6: 이유 없는 비활성 대신 불러오는 중
    : code
      ? {
          primary: sent ? {kind: 'primary', label: w.resend, onPress: send} : {label: w.send, onPress: send},
          ...(big ? {} : {secondary: {kind: 'text' as const, label: w.copy, onPress: copyCode, testID: 'wait-copy'}}),
        }
      : {primary: {label: expired ? w.new_code : w.make_code, loading: busy, onPress: makeCode}};
  const until = code ? w.until.split('{시각}').join(formatExpiry(code.expiresAt)) : '';

  return (
    <AudienceProvider value="child">
      <DsScreen variant="step" header={<WaitHeader onSettings={settings} />} dock={dock} onViewport={fold.onViewport} tail={copyLink}>
        {!state ? <Text role="body">{appCopy.loading}</Text> : null}
        {expired ? (
          <Card tone="notice" testID="wait-expired">
            <Heading level={2}>{w.expired_title}</Heading>
            <Text role="body">{w.expired_body}</Text>
            {/* new_code_note 는 뺌(디자인 결정 PR #83 L2: 만료되면 보낸 번호는 이미 못 씀 — 새 정보 아님, 시안과 같게) */}
          </Card>
        ) : null}
        {/* 리뷰 L5: 연달아 누르면 다시 마운트해 다시 읽는다 */}
        {copied ? <Banner key={copied} testID="wait-copied" tone="done" text={w.copied} /> : null}
        {code ? (
          <Card tone="outlined" testID="wait-code">
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
            {/* V9: 알림 켜기는 번호 카드 안(이미 켜졌으면 줄 없음). 큰 글자에서는 카드 바로 아래 줄로 뗀다 */}
            {big ? null : notifyRow}
          </Card>
        ) : null}
        {code && big ? notifyRow : null}
        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.group}>
            <Text role="body">{error.title}</Text>
            <Button kind="secondary" size="dock" label={error.button} onPress={() => check()} />
          </View>
        ) : null}
        {expired ? null : (
          <View style={styles.steps} testID="wait-steps" onLayout={fold.onBlock}>
            <View onLayout={fold.onItem(0)} testID="wait-steps-title" style={fold.gapStyle(0)}>
              <Heading level={2}>{w.steps_title}</Heading>
            </View>
            {w.steps.map((s, i) => (
              <View key={s} style={[styles.step, fold.gapStyle(i + 1)]} onLayout={fold.onItem(i + 1)} testID={`wait-step-${i + 1}`}>
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

/** 3단계 묶음 안 요소 사이 간격(styles.steps gap) — 접힘 위치 계산에 쓴다 */
const STEPS_GAP = 12;
/** 묶음 제목(0)은 첫 단계와 붙여 민다(첫 화면 끝에 제목만 남지 않게, PR #83 재확인 L9) */
const STEPS_GLUE = [0] as const;

const styles = StyleSheet.create({
  head: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12},
  headTitle: {flexShrink: 1},
  group: {gap: 4, alignSelf: 'stretch'},
  notify: {gap: 4, borderTopWidth: 1.5, borderTopColor: ds.color.lineSoft, paddingTop: 10, alignSelf: 'stretch'},
  notifyOut: {gap: 4, alignSelf: 'stretch'},
  steps: {gap: 12, alignSelf: 'stretch'},
  step: {flexDirection: 'row', gap: 12, alignItems: 'flex-start'},
  // 번호 원: 글자가 커지면 같이 커지게 최소 크기만(고정 상자 없음)
  num: {minWidth: 32, minHeight: 32, borderRadius: 16, paddingHorizontal: 6, backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, alignItems: 'center', justifyContent: 'center'},
  stepText: {flex: 1},
});
