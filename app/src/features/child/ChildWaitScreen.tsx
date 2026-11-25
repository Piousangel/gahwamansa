import React, {useEffect, useRef, useState} from 'react';
import {AppState, Share, StyleSheet, useWindowDimensions, View} from 'react-native';
import {CommonActions, useIsFocused} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {AudienceProvider, Banner, Button, Card, DsScreen, Heading, SettingsLink, Text, type DockProps} from '../../ui/ds';
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
import {useChildNotifyAsk} from './ChildNotifyPrompt';
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
      <SettingsLink label={copy.settings.open} onPress={onSettings} testID="wait-settings" />
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
  // 알림 권한 앞당김(기획 v2.1 0.4): 번호를 보낸(공유 창에서 돌아옴·복사) 직후, 또는 연결 직후 화면에서 우리 말 한 장 → 시스템 창.
  //   화면에 들어오자마자는 묻지 않는다. 한 장을 어떻게 닫든 C3·연결 직후 [알림 켜기] 줄은 그대로(나중에 켜는 길, C7 토글도)
  const ask = useChildNotifyAsk(notify, title);
  const {offer} = ask;
  // #296 QA-2 M2: 이 화면이 보일 때만 묻는다. [설정] 등이 위에 쌓여도 C3 는 스택 아래 마운트된 채라, 막지 않으면 설정 화면 위에 한 장이 뜨고
  //   뒤로가 화면 대신 한 장을 닫아 '오늘은 넘김'으로 기록된다. 연결은 C3 로 돌아와 연결 직후 화면을 처음 볼 때 묻는다
  const focused = useIsFocused();
  const focusedNow = useRef(focused);
  focusedNow.current = focused;
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (linked) {
      offer('done');
    } else if (sent) {
      offer('wait');
    }
  }, [focused, linked, sent, offer]);
  // #293 QA-2 L2(리드 결정): 복사한 사람은 곧 메신저로 가서 붙여 넣으려는 참이라 바로 묻지 않는다('복사했어요' 띠도 가린다).
  //   복사한 뒤 앱을 떠났다(background) 돌아오면(active) 그때 묻는다. 돌아오기 전에 연결됐으면 연결 직후 제목으로(L3와 같은 규칙).
  //   떠나지 않고 연결되면 위 effect 의 연결 직후 1회가 맡는다.
  //   M2: 다른 화면(설정 등)에 있다 돌아온 복귀는 버린다(복사의 연속이 아니므로). 복사 기록은 남겨 C3 에서 다시 다녀오면 그때 묻는다
  const didCopy = useRef(false);
  const leftAfterCopy = useRef(false);
  const linkedNow = useRef(linked);
  linkedNow.current = linked;
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') {
        leftAfterCopy.current = didCopy.current && focusedNow.current;
      } else if (s === 'active' && leftAfterCopy.current) {
        leftAfterCopy.current = false;
        if (focusedNow.current) {
          offer(linkedNow.current ? 'done' : 'wait');
        }
      }
    });
    return () => sub.remove();
  }, [offer]);
  // #296 QA-2 M1: 복사 뒤 C3 줄 [알림 켜기]를 직접 누름 = 답함. 권한 창에서 돌아오는 복귀(background→active)를 '복사 뒤 복귀'로 보지 않는다
  //   (그 복귀의 my_push_settings 읽기가 받기 동의 저장보다 먼저 끝나면 방금 켠 사람에게 같은 질문이 뜬다)
  const openFromRow = () => {
    didCopy.current = false;
    leftAfterCopy.current = false;
    notify.open();
  };

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
            // 공유 창에서 돌아왔다. RN Android Share 는 창이 열리는 순간 늘 sharedAction 으로 끝나(dismissedAction 없음) 앱을 고르지 않고
            //   닫아도 여기로 온다 — 보냈는지 알 수 없어 돌아온 것을 기준으로 한다(#293 QA-2 L1, 결정은 PR 본문)
            setSent(true);
          }
        })
        .catch(() => {});
    }
  };
  const copyCode = () => {
    if (code && copyText(code.code)) {
      track(api, 'invite_share_tapped', {channel: 'copy'}); // AC-05
      didCopy.current = true;
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

  // H1(오너 11-25): OS 권한이 꺼졌거나, 아직 '알림 켜기'(받기 동의)를 누르지 않았으면 켜는 줄을 보인다.
  //   #269 이후 동의 전에는 토큰이 없어 연결·첫 답 알림이 오지 않으므로, 권한이 이미 허용(12 이하 기본 허용)이어도 묻는다.
  const askNotify = notify.denied || notify.consented === false;
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
          {askNotify ? (
            // 연결 직후(H1): C3 에서 켜지 않은 자녀에게 한 번 더 — 첫 답 알림은 연결 뒤 한 번뿐이라 지금이 마지막 기회(0052)
            <View testID="done-notify" style={styles.notify}>
              <Text role="sub" tone="muted">
                {withTitle(d.notify, title)}
              </Text>
              <Button kind="text" size="inline" label={w.notify_button} onPress={openFromRow} />
            </View>
          ) : null}
        </DsScreen>
        {ask.node}
      </AudienceProvider>
    );
  }

  const expired = !!state && !code && state.hadExpired;
  const copiedBand = copied ? <Banner key={copied} testID="wait-copied" tone="done" text={w.copied} /> : null;
  // 재확인 2 L11: 큰 글자에서는 복사하기가 본문 맨 끝이라 '복사했어요' 띠도 그 바로 위에(카드 위면 화면 밖이라 안 보인다)
  const copyLink =
    code && big ? (
      <View style={styles.group}>
        {copiedBand}
        <Button kind="text" size="dock" label={w.copy} onPress={copyCode} testID="wait-copy" />
      </View>
    ) : null;
  const notifyRow = askNotify ? (
    <View testID="wait-notify" style={big ? styles.notifyOut : styles.notify}>
      <Text role="sub" tone="muted">
        {w.notify}
      </Text>
      <Button kind="text" size="inline" label={w.notify_button} onPress={openFromRow} />
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
        {big ? null : copiedBand}
        {code ? (
          <Card tone="outlined" testID="wait-code">
            <Text role="body">{w.code_label}</Text>
            {/* 리뷰 L6: 번호와 기한을 한 덩어리로 읽는다(복사하기는 Dock) */}
            <View accessible accessibilityLabel={`${copy.code.show_a11y.split('{앞}, {뒤}').join(codeA11y(code.code))}, ${until}`} style={styles.group} testID="wait-code-group">
              {/* D-18 B3: 묶음이 번호·기한을 한 번에 읽는다 → 안쪽 '123 456'이 따로 초점을 받아 수로 또 읽히지 않게 숨긴다 */}
              <View style={styles.group} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID="wait-code-visible">
                <Text role="display" testID="wait-code-number">
                  {formatCode(code.code)}
                </Text>
                <Text role="sub" tone="muted">
                  {until}
                </Text>
              </View>
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
      {ask.node}
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
