import React, {useState} from 'react';
import {errorMessage} from '../course/useFinishStep';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CodeEntry} from './CodeEntry';
import {TextLink} from './TextLink';
import {BackBar} from '../../app/BackBar';
import {canSubmit} from '../../ui/codeInputLogic';
import {KEY_MIN, keypadKeyHeight} from './keypadFit';
import {copy, reasonToMessage, Message} from '../../copy/copy';

export function ConnectScreen({navigation}: NativeStackScreenProps<ParentParams, 'Connect'>) {
  const {api, resetRole} = useSession();
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const [code, setCode] = useState('');
  // 6칸 + 키 4줄이 하단 고정 영역 위에 스크롤 없이 들어가게: 남은 높이를 재서 키 높이(64~68)를 정한다.
  // 64로도 모자라면 보조 문구(틀려도 괜찮아요)를 숨기고, 그래도 모자라면 키 64로 두고 본문 스크롤을 켠다.
  const [keyH, setKeyH] = useState<number | undefined>(undefined);
  const [tight, setTight] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const onArea = (e: LayoutChangeEvent) => {
    if (overflow) {
      return;
    }
    const k = keypadKeyHeight(e.nativeEvent.layout.height);
    if (k !== null) {
      setKeyH(k);
    } else if (!tight) {
      setTight(true);
    } else {
      setKeyH(KEY_MIN);
      setOverflow(true);
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

  // 이전: 역할 선택으로(어르신 스택의 첫 화면). 주 버튼은 하단 고정 영역(내비게이션 바 위).
  return (
    <Screen
      fill={!overflow}
      scrollEnabled={overflow}
      top={<BackBar onBack={resetRole} />}
      bottom={
        error ? (
          <BigButton variant="secondary" label={error.button} onPress={onErrorButton} />
        ) : (
          <>
            <TextLink label={copy.connect.view_course} onPress={() => navigation.navigate('CourseHome')} />
            <BigButton label={copy.connect.button} disabled={!canSubmit(code) || busy} onPress={submit} />
          </>
        )
      }>
      <Text20 size={26} weight="bold" accessibilityRole="header">{copy.connect.title}</Text20>
      {tight ? null : <Text20>{copy.connect.hint}</Text20>}
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
        </View>
      ) : (
        <View testID="keypad-area" style={overflow ? null : styles.area} onLayout={onArea}>
          <CodeEntry value={code} onChange={setCode} keyHeight={keyH} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({area: {flex: 1, minHeight: 0}});
