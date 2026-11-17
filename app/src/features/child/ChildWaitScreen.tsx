import React, {useState} from 'react';
import {Image, Share, StyleSheet, View} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {TopBar} from '../../ui/TopBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {useToast} from '../../ui/Toast';
import {SmallButton} from '../../ui/SmallButton';
import {copyText} from '../../ui/clipboard';
import {Icon} from '../../ui/assets/icons';
import {assetRegistry} from '../../ui/assets/registry';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {formatCode} from '../../ui/codeInputLogic';
import {color, radius} from '../../ui/tokens';
import {useBootLoading} from '../../app/splash';
import {childErrorMessage} from '../../shared/childError';
import {buildShareMessage, codeA11y, formatExpiry} from '../../lib/childFormat';
import {useNotifyPermission} from './useNotifyPermission';
import {useChildWaitState} from './useChildWaitState';

const w = copy.child.wait;

// C3 연결 대기 v4: 막다른 화면 대신 번호 카드(번호·만료 시각·복사) → 부모님 폰 3단계 → 예시 1장(보기 전용).
// 만료 전에는 새 번호 만들기 없음(받으면 이미 보낸 번호가 무효). 만료되면 제목·칩 대신 안내 상자 + "새 번호 만들기".
export function ChildWaitScreen({navigation}: NativeStackScreenProps<ChildParams, 'Wait'>) {
  const {api} = useSession();
  const {state, error, setError, check} = useChildWaitState(api);
  const [busy, setBusy] = useState(false);
  const [renewed, setRenewed] = useState(false); // 이 화면에서 지난 번호 대신 새 번호를 만들었다
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
      Share.share({message: buildShareMessage(copy.code.share, code.code, formatExpiry(code.expiresAt))}).catch(() => {});
    }
  };
  const copyCode = () => {
    if (code && copyText(code.code)) {
      show({text: w.copied});
    }
  };
  const settings = () => navigation.navigate('Settings');

  if (linked) {
    const d = copy.connect_done;
    return (
      <Screen
        bottom={
          <BigButton
            label={d.button}
            onPress={() => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Tabs'}]}))}
          />
        }>
        <Text20 size={28} weight="bold">{d.title}</Text20>
        {d.body.map(l => (
          <Text20 key={l}>{withTitle(l, title)}</Text20>
        ))}
      </Screen>
    );
  }

  const expired = !!state && !code && state.hadExpired;
  const bottom = !state ? (
    <BigButton label={w.send} disabled onPress={() => {}} />
  ) : code ? (
    <BigButton label={w.send} onPress={send} />
  ) : (
    <BigButton label={expired ? w.new_code : w.make_code} loading={busy} onPress={makeCode} />
  );

  return (
    <View style={styles.flex}>
      <Screen top={<TopBar settingsLabel={copy.settings.open} onSettings={settings} />} bottom={bottom}>
        {!state ? (
          <Text20>{appCopy.loading}</Text20>
        ) : expired ? (
          <View testID="wait-expired" style={styles.notice} accessibilityLiveRegion="polite">
            <Text20 size={24} weight="bold">{w.expired_title}</Text20>
            <Text20>{w.expired_body}</Text20>
          </View>
        ) : (
          <>
            <View style={styles.chip} testID="wait-chip">
              <Text20 weight="bold">{w.chip}</Text20>
            </View>
            <Text20 size={28} weight="bold" accessibilityRole="header">{withTitle(w.title, title)}</Text20>
          </>
        )}
        {code ? (
          <View testID="wait-code" style={styles.card}>
            <View style={styles.cardHead}>
              <Text20 weight="bold" style={styles.sub}>{w.code_label}</Text20>
              <SmallButton label={w.copy} onPress={copyCode} />
            </View>
            {/* 리뷰 L6: 번호와 기한을 한 덩어리로 읽는다(복사하기 버튼은 따로) */}
            <View
              accessible
              accessibilityLabel={`${copy.code.show_a11y.split('{앞}, {뒤}').join(codeA11y(code.code))}, ${w.until.split('{시각}').join(formatExpiry(code.expiresAt))}`}>
              <Text20 size={44} weight="bold" selectable style={styles.code}>
                {formatCode(code.code)}
              </Text20>
              <Text20>{w.until.split('{시각}').join(formatExpiry(code.expiresAt))}</Text20>
            </View>
            {renewed ? <Text20 weight="bold">{copy.code.old_invalid}</Text20> : null}
          </View>
        ) : null}
        {error ? (
          <View accessibilityLiveRegion="polite">
            <Text20 weight="bold">{error.title}</Text20>
            <BigButton variant="secondary" label={error.button} onPress={() => check()} />
          </View>
        ) : null}
        <View style={styles.steps}>
          <Text20 size={24} weight="bold">{w.steps_title}</Text20>
          {w.steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={styles.num}>
                <Text20 weight="bold" style={styles.numText}>{String(i + 1)}</Text20>
              </View>
              <View style={styles.flex}>
                <Text20>{withTitle(s, title)}</Text20>
                {i === 1 ? (
                  // 부모님 첫 화면의 실제 버튼 글자(누를 수 없는 그림)
                  <View style={styles.fakeButton} accessible accessibilityLabel={copy.first.parent}>
                    <Text20 weight="bold">{copy.first.parent}</Text20>
                    <Icon name="icon-chevron-right" size={22} color={color.ink} />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        {/* 알림은 보조: 할 일(3단계) 다음 */}
        {state && notify.denied ? (
          <View testID="wait-notify" style={styles.row}>
            <Text20 style={styles.flex}>{w.notify}</Text20>
            <SmallButton label={w.notify_button} onPress={notify.open} />
          </View>
        ) : null}
        <View testID="wait-example" style={styles.example}>
          <View style={styles.exampleHead}>
            <View style={styles.chip}>
              <Text20 weight="bold">{w.example_chip}</Text20>
            </View>
            <Text20 weight="bold" style={styles.flex}>{w.example_title}</Text20>
          </View>
          <View style={styles.polaroid}>
            {assetRegistry['intro-photo'] ? (
              <Image source={assetRegistry['intro-photo']} style={styles.photo} accessibilityIgnoresInvertColors resizeMode="cover" />
            ) : null}
            <Text20 style={styles.sub}>{appCopy.ai_photo_label}</Text20>
            <Text20 size={24} weight="bold">{w.example_question}</Text20>
          </View>
          <Text20 style={styles.sub}>{w.example_note}</Text20>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  chip: {alignSelf: 'flex-start', backgroundColor: color.actionSoft, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 4},
  notice: {backgroundColor: color.noticeSoft, borderRadius: radius.card, padding: 16, gap: 6},
  card: {backgroundColor: color.card, borderRadius: radius.card, borderWidth: 3, borderColor: color.line, padding: 16, gap: 6},
  cardHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  code: {letterSpacing: 4, textAlign: 'center'},
  sub: {color: color.inkSub},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.paperSoft, borderRadius: radius.card, padding: 12},
  steps: {gap: 12},
  step: {flexDirection: 'row', gap: 12, alignItems: 'flex-start'},
  num: {width: 36, height: 36, borderRadius: 18, backgroundColor: color.action, alignItems: 'center', justifyContent: 'center'},
  numText: {color: color.onAction},
  fakeButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 8, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.button, borderWidth: 3, borderColor: color.lineGhost, backgroundColor: color.paperSoft,
  },
  example: {backgroundColor: color.paperSoft, borderRadius: radius.card, padding: 16, gap: 10},
  exampleHead: {flexDirection: 'row', alignItems: 'center', gap: 8},
  polaroid: {backgroundColor: color.card, padding: 12, paddingBottom: 16, borderRadius: 6, gap: 6, transform: [{rotate: '-1.5deg'}]},
  photo: {width: '100%', aspectRatio: 4 / 3, borderRadius: 2, backgroundColor: color.paperEdge},
});
