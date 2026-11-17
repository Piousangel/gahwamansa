import React, {useState} from 'react';
import {errorMessage} from '../course/useFinishStep';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {color} from '../../ui/tokens';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CodeEntry} from './CodeEntry';
import {TextLink} from './TextLink';
import {BackBar} from '../../app/BackBar';
import {canSubmit} from '../../ui/codeInputLogic';
import {KEY_MIN, keypadKeyHeight} from './keypadFit';
import {copy, reasonToMessage, Message} from '../../copy/copy';

export function ConnectScreen({navigation, route}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api, resetRole} = useSession();
  // 코스 홈·설정에서 "번호 쓰기"로 왔으면 이전은 그 화면으로, 처음 화면에서 왔으면 역할 선택으로(QA B2)
  const back = route.params?.from === 'course' ? () => navigation.goBack() : resetRole;
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const [code, setCode] = useState('');
  // 6칸 + 키 4줄은 무조건 전부 보이게(최우선). 남은 높이(keypad-area, 자식 크기에 영향받지 않게 재는 영역)로
  // 키 높이(64~68)를 정하고, 모자라면 공간을 단계별로 만든다:
  //   1단계 보조 문구(틀려도 괜찮아요) 숨김 → 2단계 제목 26→22 → 3단계 링크 두 개를 이전 바 줄로 올림
  //   → 4단계 키 64 + 본문 스크롤(작은 화면·3버튼 내비게이션 등, 잘리지 않게)
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
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.redeemInviteCode(code);
      if (res.ok) {
        navigation.navigate('Consent');
        return;
      }
      setError(reasonToMessage(res.reason));
      setReason(res.reason);
      if (res.reason === 'invalid') {
        setCode(''); // 틀린 번호면 입력을 비운다
      }
    } catch (e) {
      setReason(null);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const onErrorButton = () => {
    setError(null);
    if (reason === 'already_linked') {
      navigation.navigate('Consent');
    } else if (reason === 'not_parent_device') {
      resetRole(); // "처음 화면에서 다시 골라 주세요"
    }
  };

  // 링크 두 개는 한 줄에 나란히(64 터치). 비활성 "다음"의 이유는 화면 읽기 힌트로만(키패드 공간 우선)
  const links = (
    <View testID="connect-links" style={styles.links}>
      <TextLink label={copy.connect.no_code_link} touch={64} onPress={() => setHelp(h => !h)} />
      <TextLink label={copy.connect.view_course} touch={64} onPress={() => navigation.navigate('CourseHome')} />
    </View>
  );
  // 이전: 역할 선택으로(어르신 스택의 첫 화면). 주 버튼은 하단 고정 영역(내비게이션 바 위).
  return (
    <Screen
      fill={!overflow}
      scrollEnabled={overflow}
      top={
        linksOnTop && !error ? (
          <View style={styles.topRow}>
            <BackBar onBack={back} />
            {links}
          </View>
        ) : (
          <BackBar onBack={back} />
        )
      }
      bottom={
        error ? (
          <BigButton variant="secondary" label={error.button} onPress={onErrorButton} />
        ) : (
          <>
            {/* 시안 P1: 이유 줄(6자리 전) → 다음 → 번호가 없어요·코스 보기. 이유 줄은 버튼 힌트로 읽으므로 화면 읽기에서 뺀다(R8) */}
            {canSubmit(code) || busy ? null : (
              <Text20 style={styles.reason} importantForAccessibility="no" accessibilityElementsHidden>
                {copy.connect.need_six}
              </Text20>
            )}
            <BigButton
              label={copy.connect.button}
              disabled={!canSubmit(code) || busy}
              accessibilityHint={canSubmit(code) ? undefined : copy.connect.need_six}
              onPress={submit}
            />
            {linksOnTop ? null : links}
          </>
        )
      }>
      <Text20 size={level >= 2 ? 22 : 26} weight="bold" accessibilityRole="header" textBreakStrategy="balanced" style={styles.title}>
        {TITLE}
      </Text20>
      {help ? <Text20 accessibilityLiveRegion="polite">{copy.connect.no_code_help}</Text20> : level >= 1 ? null : <Text20 style={styles.hint}>{copy.connect.hint}</Text20>}
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </View>
      ) : (
        <View testID="keypad-area" style={overflow ? null : styles.area} onLayout={onArea}>
          {/* 영역 크기를 키패드가 밀어 올리지 않게 위에 띄워 둔다(스크롤 모드에서는 보통 배치) */}
          <View style={overflow ? null : styles.pinned}>
            <CodeEntry value={code} onChange={setCode} keyHeight={keyH} />
          </View>
        </View>
      )}
    </Screen>
  );
}

// "써 주세요"가 갈라져 "주세요"만 다음 줄에 남지 않게 붙인다(QA P1#5)
const TITLE = copy.connect.title.replace('써 주세요', '써\u00A0주세요');

const styles = StyleSheet.create({
  area: {flex: 1, minHeight: 0, overflow: 'hidden'},
  pinned: {position: 'absolute', top: 0, left: 0, right: 0},
  links: {flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', columnGap: 16},
  topRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'},
  title: {color: color.inkTitle},
  hint: {color: color.inkSub},
  reason: {color: color.inkSub, textAlign: 'center'},
});
