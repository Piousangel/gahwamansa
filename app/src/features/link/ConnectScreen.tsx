import React, {useEffect, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {Icon} from '../../ui/assets/icons';
import {focusLater} from '../../ui/screenTitle';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {color, radius} from '../../ui/tokens';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CodeEntry} from './CodeEntry';
import {TextLink} from './TextLink';
import {BackBar} from '../../app/BackBar';
import {formatCode} from '../../ui/codeInputLogic';
import {BELOW_LINE_H, KEY_MIN, keypadKeyHeight} from './keypadFit';
import {copy, offlineMessage, reasonToMessage, withTitle, Message} from '../../copy/copy';
import {useConnectFlow} from './useConnectFlow';
import {consumeInvite} from '../../lib/linkSources';
import type {ConnectState, FailKind} from './connectMachine';

// 안내 패널 문구: 번호 문제는 기존 확정 문구(5절, copy-v3 11-3 "P1c 만료·사용됨" 재사용), 잠김은 rate_limited, 인터넷·서버는 공통
function failMessage(reason: FailKind): Message {
  if (reason === 'offline') {
    return offlineMessage;
  }
  if (reason === 'server') {
    return copy.errors.server;
  }
  return reasonToMessage(reason === 'locked' ? 'rate_limited' : reason);
}

// 번호 칸 묶음 읽기(라이터 확정 11-2 #12)
function groupA11y(code: string): string {
  const g = copy.connect.code_group_a11y;
  return code.length === 0 ? g.empty : code.length >= 6 ? g.full : g.partial.split('{n}').join(String(code.length));
}

// 하단 약관 한 줄(11-1 #1). TODO(⑥a 방침 호스팅): 이용약관·처리방침 주소가 정해지면 두 낱말을 링크로
function LegalLine() {
  return <Text20 testID="legal-line" style={styles.legal}>{copy.legal.agree_parent}</Text20>;
}

// P1 번호 쓰기 v4 + P1c 연결 확인(시안 P1_connect_v4·P1c_confirm, ease-and-joy A④⑤). 문구는 copy-v3 11절 우선.
// 6자리를 다 쓰면 300ms 뒤 저절로 확인("다음" 없음), 맞으면 누가 보낸 번호인지 보여 주고 [이 번호로 연결하기]를 눌러야 연결(자동 연결 금지).
// 맞지 않으면 숫자는 그대로 두고 칸 아래 한 줄. 상태 전이는 connectMachine·useConnectFlow.
export function ConnectScreen({navigation, route}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api, resetRole} = useSession();
  // 코스 홈·설정에서 "번호 쓰기"로 왔으면 이전은 그 화면으로, 처음 화면에서 왔으면 역할 선택으로(QA B2)
  const fromCourse = route.params?.from === 'course';
  const back = fromCourse ? () => navigation.goBack() : resetRole;
  // 번호가 맞으면 스택을 [번호, 동의]로 정리한다(코스 홈에서 왔어도 미리보기 코스 홈·번호 화면이 뒤에 남지 않게, 리뷰 ③)
  const toConsent = () => navigation.dispatch(CommonActions.reset({index: 1, routes: [{name: 'Connect'}, {name: 'Consent'}]}));
  const prefill = route.params?.prefill;
  const flow = useConnectFlow(api, prefill);
  const {state, edit, redeem, retry} = flow;
  // 미리 채운 번호는 한 번 쓰면 기기에서 지운다(연결됨·쓸 수 없는 번호·다른 번호 쓰기). 띠도 함께 사라진다
  const prefillDone =
    !!prefill &&
    (state.kind === 'ok' ||
      (state.kind === 'failed' && (state.reason === 'expired' || state.reason === 'used' || state.reason === 'not_parent_device' || state.reason === 'already_linked')) ||
      (state.kind === 'idle' && state.inline === 'invalid' && state.code === prefill.code));
  useEffect(() => {
    if (prefillDone) {
      consumeInvite().catch(() => {});
    }
  }, [prefillDone]);
  const other = () => {
    if (prefill && state.kind !== 'redeeming') {
      consumeInvite().catch(() => {});
    }
    flow.other();
  };

  // 6칸 + 칸 아래 한 줄 + 키 4줄은 무조건 전부 보이게(최우선). 남은 높이로 키 높이(64~68)를 정하고, 모자라면 단계별로:
  //   1단계 안심 줄 숨김 → 2단계 제목 28→22 → 3단계 링크 두 개를 이전 바 줄로 → 4단계 키 64 + 본문 스크롤
  const [keyH, setKeyH] = useState<number | undefined>(undefined);
  const [level, setLevel] = useState(0);
  const [help, setHelp] = useState(false);
  const overflow = level >= 4;
  const linksOnTop = level >= 3;
  const onArea = (e: LayoutChangeEvent) => {
    if (overflow) {
      return;
    }
    const k = keypadKeyHeight(e.nativeEvent.layout.height - BELOW_LINE_H);
    if (k !== null) {
      setKeyH(k);
    } else if (level < 3) {
      setLevel(l => l + 1);
    } else {
      setKeyH(KEY_MIN);
      setLevel(4);
    }
  };

  const ok = state.kind === 'ok';
  const groupRef = useRef<React.ComponentRef<typeof View>>(null);
  const isInvalid = state.kind === 'idle' && state.inline === 'invalid';
  useEffect(() => (isInvalid ? focusLater(() => groupRef.current) : undefined), [isInvalid]);
  useEffect(() => {
    if (ok) {
      toConsent();
    }
    // 연결되면 한 번만 넘어간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  if (state.kind === 'confirm' || state.kind === 'redeeming') {
    // key: 같은 화면 안 분기라도 새 Screen 으로 마운트해 제목에 포커스(talkback R2, 리뷰 M2)
    return <ConfirmView key="confirm" state={state} onYes={redeem} onOther={other} />;
  }
  if (state.kind === 'failed') {
    const m = failMessage(state.reason);
    const onFailButton = () => {
      if (state.reason === 'already_linked') {
        toConsent();
      } else if (state.reason === 'not_parent_device') {
        resetRole(); // "처음 화면에서 다시 골라 주세요"
      } else {
        retry(); // 인터넷·서버면 같은 단계 다시, 번호 문제면 비우고 번호 쓰기로
      }
    };
    return (
      <Screen key="failed" top={<BackBar onBack={state.step === 'redeem' ? other : back} />} bottom={<BigButton variant="secondary" label={m.button} onPress={onFailButton} />}>
        <View testID="connect-failed" accessibilityLiveRegion="polite" style={styles.failed}>
          <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{m.title}</Text20>
          <Text20>{m.body}</Text20>
        </View>
      </Screen>
    );
  }

  const checking = state.kind === 'peeking' || ok;
  const invalid = state.kind === 'idle' && state.inline === 'invalid';
  // 칸 바로 아래 한 줄: 기본 안내 / 확인 중 / 맞지 않음(숫자는 그대로).
  // 항상 마운트된 live region 하나에 글만 바꾼다(새로 붙은 노드는 기기에 따라 안 읽힘, 리뷰 M2·R11)
  const below = (
    <View testID="connect-below" accessibilityLiveRegion="polite" style={styles.belowRow}>
      {invalid ? <Icon name="icon-warning" size={24} color={color.dangerInk} /> : null}
      <Text20
        testID={checking ? 'connect-checking' : invalid ? 'connect-invalid' : 'connect-hint'}
        weight={checking || invalid ? 'bold' : undefined}
        style={[styles.flex, checking ? styles.title : invalid ? styles.invalid : styles.sub]}>
        {checking ? copy.connect.checking : invalid ? copy.connect.invalid_inline : copy.connect.auto_hint}
      </Text20>
    </View>
  );
  // 링크 두 개: 가운데 정렬, 간격 24, 64 터치(시안 P1_connect_v4)
  const links = (
    <View testID="connect-links" style={styles.links}>
      <TextLink label={copy.connect.no_code_link} touch={64} onPress={() => setHelp(h => !h)} />
      <TextLink label={copy.connect.view_course} touch={64} onPress={() => (fromCourse ? navigation.popTo('CourseHome') : navigation.navigate('CourseHome'))} />
    </View>
  );

  return (
    <Screen
      key="entry"
      fill={!overflow}
      scrollEnabled={overflow}
      top={
        linksOnTop ? (
          <View style={styles.topRow}>
            <BackBar onBack={back} />
            {links}
          </View>
        ) : (
          <BackBar onBack={back} />
        )
      }
      bottom={
        <>
          {linksOnTop ? null : links}
          <LegalLine />
        </>
      }>
      <Text20 size={level >= 2 ? 22 : 28} weight="bold" accessibilityRole="header" textBreakStrategy="balanced" style={styles.title}>
        {TITLE}
      </Text20>
      {help ? <Text20 accessibilityLiveRegion="polite">{copy.connect.no_code_help}</Text20> : null}
      {/* 안심 줄은 모든 글자 크기·좁은 화면에서도 유지(UX U4, 동결 시안 P1_connect_v4). 모자라면 뒤 단계(제목 줄임·링크 위로·스크롤)로 */}
      <Text20 testID="connect-safe">{copy.safe.money}</Text20>
      <View testID="keypad-area" style={overflow ? null : styles.area} onLayout={onArea}>
        {/* 영역 크기를 키패드가 밀어 올리지 않게 위에 띄워 둔다(스크롤 모드에서는 보통 배치) */}
        <View style={overflow ? null : styles.pinned}>
          <CodeEntry value={state.code} onChange={edit} keyHeight={keyH} groupLabel={groupA11y(state.code)} belowCells={below} groupRef={groupRef} />
        </View>
      </View>
    </Screen>
  );
}

// P1c 연결 확인(시안 P1c_confirm): 제목 · 카드({호칭} 폰으로 보낸 번호예요 + 큰 번호) · 안심 줄 / [이 번호로 연결하기] · 약관 줄 · 다른 번호 쓰기
function ConfirmView({state, onYes, onOther}: {state: Extract<ConnectState, {kind: 'confirm' | 'redeeming'}>; onYes: () => void; onOther: () => void}) {
  const c = copy.connect_confirm;
  const busy = state.kind === 'redeeming';
  const a11y = copy.code.show_a11y.split('{앞}').join(state.code.slice(0, 3).split('').join(' ')).split('{뒤}').join(state.code.slice(3).split('').join(' '));
  return (
    <Screen
      top={<BackBar onBack={busy ? noop : onOther} />}
      bottom={
        <>
          <BigButton label={c.yes} loading={busy} loadingLabel={c.busy} onPress={onYes} />
          <LegalLine />
          <View style={styles.links}>
            <TextLink label={c.other} touch={64} disabled={busy} onPress={onOther} />
          </View>
        </>
      }>
      <Text20 size={30} weight="bold" accessibilityRole="header" style={styles.title}>{c.title}</Text20>
      <View testID="confirm-card" style={styles.card}>
        {state.title ? (
          <Text20 testID="confirm-from" size={22} style={styles.center}>{withTitle(c.from, state.title)}</Text20>
        ) : null}
        <View testID="confirm-code" accessible accessibilityLabel={a11y}>
          <Text20 size={52} weight="bold" style={styles.code}>{formatCode(state.code)}</Text20>
        </View>
      </View>
      <Text20>{copy.safe.money}</Text20>
    </Screen>
  );
}

// "써 주세요"가 갈라져 "주세요"만 다음 줄에 남지 않게 붙인다(QA P1#5)
const TITLE = copy.connect.title.replace('써 주세요', '써\u00A0주세요');
// 연결 중 이전(리뷰 M1): 화면을 바꾸지 않고 하드웨어 뒤로도 삼킨다
const noop = () => {};

const styles = StyleSheet.create({
  area: {flex: 1, minHeight: 0, overflow: 'hidden'},
  pinned: {position: 'absolute', top: 0, left: 0, right: 0},
  links: {flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 24},
  topRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'},
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  invalid: {color: color.dangerInk},
  legal: {textAlign: 'center', color: color.ink, marginBottom: 4},
  belowRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  flex: {flex: 1},
  failed: {gap: 8},
  card: {backgroundColor: color.card, borderWidth: 3, borderColor: color.action, borderRadius: radius.card, padding: 20, gap: 10},
  center: {textAlign: 'center', color: color.inkTitle},
  code: {letterSpacing: 6, textAlign: 'center', color: color.inkTitle},
});
