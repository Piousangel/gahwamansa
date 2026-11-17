import React, {useEffect, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
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
import {KEY_MIN, keypadKeyHeight} from './keypadFit';
import {copy, offlineMessage, reasonToMessage, withTitle, Message} from '../../copy/copy';
import {useConnectFlow} from './useConnectFlow';
import type {ConnectState, FailKind} from './connectMachine';

// 안내 패널 문구: 번호 문제는 기존 확정 문구(5절), 잠김은 rate_limited, 인터넷·서버는 공통
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

// P1 번호 쓰기 + P1c 연결 확인(ease-and-joy A④⑤). 6자리를 다 쓰면 300ms 뒤 저절로 확인("다음" 없음),
// 맞으면 누가 보낸 번호인지 보여 주고 [이 번호로 연결하기]를 눌러야 연결한다(자동 연결 금지). 틀려도 숫자는 그대로.
// TODO(디자인 P1c 시안): 확인 화면은 시안 전 최소판(기존 컴포넌트). 시안이 오면 레이아웃만 바꾼다(로직은 useConnectFlow).
export function ConnectScreen({navigation, route}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api, resetRole} = useSession();
  // 코스 홈·설정에서 "번호 쓰기"로 왔으면 이전은 그 화면으로, 처음 화면에서 왔으면 역할 선택으로(QA B2)
  const fromCourse = route.params?.from === 'course';
  const back = fromCourse ? () => navigation.goBack() : resetRole;
  // 번호가 맞으면 스택을 [번호, 동의]로 정리한다(코스 홈에서 왔어도 미리보기 코스 홈·번호 화면이 뒤에 남지 않게, 리뷰 ③)
  const toConsent = () => navigation.dispatch(CommonActions.reset({index: 1, routes: [{name: 'Connect'}, {name: 'Consent'}]}));
  const {state, edit, redeem, other, retry} = useConnectFlow(api, route.params?.prefill);

  // 6칸 + 키 4줄은 무조건 전부 보이게(최우선). 남은 높이로 키 높이(64~68)를 정하고, 모자라면 단계별로 공간을 만든다:
  //   1단계 안내 줄 숨김 → 2단계 제목 26→22 → 3단계 링크 두 개를 이전 바 줄로 → 4단계 키 64 + 본문 스크롤
  const [keyH, setKeyH] = useState<number | undefined>(undefined);
  const [level, setLevel] = useState(0);
  const [help, setHelp] = useState(false);
  const overflow = level >= 4;
  const linksOnTop = level >= 3;
  const onArea = (e: LayoutChangeEvent) => {
    if (overflow) {
      return;
    }
    const k = keypadKeyHeight(e.nativeEvent.layout.height);
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
  const alreadyLinked = state.kind === 'failed' && state.reason === 'already_linked';
  useEffect(() => {
    if (ok) {
      toConsent();
    }
    // 연결되면 한 번만 넘어간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  const onFailButton = () => {
    if (alreadyLinked) {
      toConsent();
    } else if (state.kind === 'failed' && state.reason === 'not_parent_device') {
      resetRole(); // "처음 화면에서 다시 골라 주세요"
    } else {
      retry();
    }
  };

  if (state.kind === 'confirm' || state.kind === 'redeeming') {
    return <ConfirmView state={state} onYes={redeem} onOther={other} onBack={other} />;
  }
  if (state.kind === 'failed') {
    const m = failMessage(state.reason);
    return (
      <Screen top={<BackBar onBack={back} />} bottom={<BigButton variant="secondary" label={m.button} onPress={onFailButton} />}>
        <View testID="connect-failed" accessibilityLiveRegion="polite">
          <Text20 size={24} weight="bold" accessibilityRole="header">{m.title}</Text20>
          <Text20>{m.body}</Text20>
        </View>
      </Screen>
    );
  }

  const checking = state.kind === 'peeking' || ok;
  const invalid = state.kind === 'idle' && state.inline === 'invalid';
  // 링크 두 개는 한 줄에 나란히(64 터치)
  const links = (
    <View testID="connect-links" style={styles.links}>
      <TextLink label={copy.connect.no_code_link} touch={64} onPress={() => setHelp(h => !h)} />
      <TextLink label={copy.connect.view_course} touch={64} onPress={() => (fromCourse ? navigation.popTo('CourseHome') : navigation.navigate('CourseHome'))} />
    </View>
  );
  // 칸 바로 위 한 줄: 확인 중 / 없는 번호 / 번호가 없어요 안내(공간이 모자라면 1단계에서 숨김, 상태 알림은 숨기지 않음)
  const line = checking ? (
    <Text20 testID="connect-checking" accessibilityLiveRegion="polite" style={styles.sub}>{copy.connect.checking}</Text20>
  ) : invalid ? (
    <Text20 testID="connect-invalid" weight="bold" accessibilityLiveRegion="polite" style={styles.invalid}>{copy.connect.invalid_inline}</Text20>
  ) : help ? (
    <Text20 accessibilityLiveRegion="polite">{copy.connect.no_code_help}</Text20>
  ) : null;

  return (
    <Screen
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
      bottom={linksOnTop ? undefined : links}>
      <Text20 size={level >= 2 ? 22 : 26} weight="bold" accessibilityRole="header" textBreakStrategy="balanced" style={styles.title}>
        {TITLE}
      </Text20>
      {line}
      <View testID="keypad-area" style={overflow ? null : styles.area} onLayout={onArea}>
        {/* 영역 크기를 키패드가 밀어 올리지 않게 위에 띄워 둔다(스크롤 모드에서는 보통 배치) */}
        <View style={overflow ? null : styles.pinned}>
          <CodeEntry value={state.code} onChange={edit} keyHeight={keyH} groupLabel={groupA11y(state.code)} />
        </View>
      </View>
    </Screen>
  );
}

// P1c 연결 확인(최소판): 제목 · {호칭} 폰으로 보낸 번호예요 · 큰 번호 · 안심 한 줄 / [이 번호로 연결하기] · 다른 번호 쓰기
function ConfirmView({state, onYes, onOther, onBack}: {state: Extract<ConnectState, {kind: 'confirm' | 'redeeming'}>; onYes: () => void; onOther: () => void; onBack: () => void}) {
  const c = copy.connect_confirm;
  const busy = state.kind === 'redeeming';
  const a11y = copy.code.show_a11y.split('{앞}').join(state.code.slice(0, 3).split('').join(' ')).split('{뒤}').join(state.code.slice(3).split('').join(' '));
  return (
    <Screen
      top={<BackBar onBack={onBack} />}
      bottom={
        <>
          <BigButton label={c.yes} loading={busy} onPress={onYes} />
          <View style={styles.links}>
            <TextLink label={c.other} touch={64} disabled={busy} onPress={onOther} />
          </View>
        </>
      }>
      <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>{c.title}</Text20>
      <Text20 testID="confirm-from">{withTitle(c.from, state.title)}</Text20>
      <View testID="confirm-code" style={styles.codeBox} accessible accessibilityLabel={a11y}>
        <Text20 size={44} weight="bold" style={styles.code}>{formatCode(state.code)}</Text20>
      </View>
      <Text20 style={styles.sub}>{copy.safe.money}</Text20>
    </Screen>
  );
}

// "써 주세요"가 갈라져 "주세요"만 다음 줄에 남지 않게 붙인다(QA P1#5)
const TITLE = copy.connect.title.replace('써 주세요', '써 주세요');

const styles = StyleSheet.create({
  area: {flex: 1, minHeight: 0, overflow: 'hidden'},
  pinned: {position: 'absolute', top: 0, left: 0, right: 0},
  links: {flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', columnGap: 16},
  topRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'},
  title: {color: color.inkTitle},
  sub: {color: color.inkSub},
  invalid: {color: color.dangerInk},
  codeBox: {borderWidth: 3, borderColor: color.line, borderRadius: radius.card, backgroundColor: color.card, padding: 16, alignItems: 'center'},
  code: {letterSpacing: 4},
});
