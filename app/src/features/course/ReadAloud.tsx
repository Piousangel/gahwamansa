import React, {useContext, useEffect, useRef, useState} from 'react';
import {Linking, Platform, StyleSheet, View} from 'react-native';
import {NavigationContext} from '@react-navigation/native';
import {Button, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {getMediaVolume, useReadAloud} from '../../audio';
import {copy} from '../../copy/copy';
import {readTextBuilders} from '../../audio/readText';

const t = copy.tts;

// AP-03 읽어 주기(시안 PX_read_aloud, 문구 copy tts.* WR-03).
// - 위치: 읽을 글 바로 아래 가운데 한 개(P4 회상 질문·P5 질문·P6 낱말·P8 응원). 자동으로 읽지 않는다(공공장소 소리 방지).
// - 화면 읽기(TalkBack) 켜짐이면 숨김(R16, readAloudAllowed 한 곳). 아이콘만 쓰지 않음. v4 보조 Button(높이·글자는 역할 토큰).
// - 상태: 기본 '읽어 주세요' → 읽는 중 '멈추기'(다시 누르면 멈춤) → 다 읽으면 저절로 기본.
// - 화면을 떠나면 멈춘다(재검토 R1): native-stack 은 다음 화면으로 갈 때 이 화면을 언마운트하지 않으므로 blur 에서 멈춘다.
// - 예외 3상태(누른 뒤): 한국어 음성 없음 = 안내 상자 + '휴대폰 설정 열기', 휴대폰 소리 0 = 한 줄, 읽기 실패 = 한 줄.
export type Notice = null | 'no_korean' | 'muted' | 'failed';

/** 읽어 주기 문장 만들기(copy tts.read 틀, 순수 함수는 audio/readText — 미리 생성 음성 스크립트와 같은 함수). 화면은 이것으로 읽을 글을 만든다 */
export const ttsText = readTextBuilders(t.read);

/**
 * 읽어 주기 동작(누름·상태·예외 안내)만 — 버튼 자리는 화면이 정한다(P4 는 질문 바로 아래 가로 채움, P5·P6·P8 은 읽을 글 아래 가운데).
 * allowed=false(화면 읽기 켜짐, R16)면 버튼을 두지 않는다.
 */
export function useReadAloudAction(text: string, onSpeaking?: (mine: boolean) => void) {
  const {allowed, speaking, speak, stop} = useReadAloud();
  const [notice, setNotice] = useState<Notice>(null);
  const started = useRef(false); // 이 버튼이 시작한 읽기인가(다른 화면이 읽는 중이면 '멈추기'로 바꾸지 않음)
  // 누른 순간부터 읽기 시작까지(소리 크기 확인 중): 진행 표시·두 번 누름 잠금. 그 사이 화면을 떠나면 읽지 않는다(리뷰 M1)
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const left = useRef(false); // 이 화면을 떠났거나(blur) 사라짐(언마운트)
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
    };
  }, []);
  const mine = (speaking && started.current) || pending;
  useEffect(() => {
    if (!speaking) {
      started.current = false;
    }
  }, [speaking]);
  useEffect(() => {
    onSpeaking?.(mine);
  }, [mine, onSpeaking]);

  // 화면 이탈(blur) 때 멈춤. 내비게이터 밖(단독 테스트)이면 언마운트 정리(useReadAloud)만
  const navigation = useContext(NavigationContext);
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (!navigation) {
      return undefined;
    }
    const offFocus = navigation.addListener('focus', () => {
      left.current = false;
    });
    const offBlur = navigation.addListener('blur', () => {
      left.current = true;
      if (started.current) {
        started.current = false;
        stopRef.current();
      }
    });
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  const press = async () => {
    if (pendingRef.current) {
      return; // 소리 크기 확인 중 다시 누름은 무시(읽기 한 번)
    }
    if (speaking && started.current) {
      started.current = false;
      await stop();
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    try {
      const volume = await getMediaVolume();
      if (left.current) {
        return; // 기다리는 사이 화면을 떠났다: 떠난 화면에서 읽지 않는다
      }
      if (volume === 0) {
        setNotice('muted');
        return;
      }
      started.current = true;
      const r = await speak(text);
      if (r !== 'spoken') {
        started.current = false;
        if (!left.current) {
          setNotice(r === 'no_korean_voice' ? 'no_korean' : r === 'blocked' ? null : 'failed');
        }
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return {allowed, label: mine ? t.stop : t.button, busy: pending, onPress: press, notice};
}

/** 예외 3상태 안내(누른 뒤): 한국어 음성 없음 = 상자 + '휴대폰 설정 열기', 소리 0·실패 = 한 줄 */
export function ReadAloudNotice({notice}: {notice: Notice}) {
  if (notice === 'no_korean') {
    return (
      <View testID="tts-no-korean" accessibilityLiveRegion="polite" style={styles.box}>
        <Text role="bodyLg" tone="default">{t.no_korean.title}</Text>
        <Text role="body">{t.no_korean.body}</Text>
        <Button kind="secondary" size="inline" label={t.no_korean.button} onPress={openTtsSettings} />
      </View>
    );
  }
  if (!notice) {
    return null;
  }
  return (
    <View testID={`tts-${notice}`} accessibilityLiveRegion="polite">
      <Text role="body" style={styles.line}>{notice === 'muted' ? t.muted : t.failed}</Text>
    </View>
  );
}

/** 읽을 글 바로 아래 가운데 버튼 하나 + 안내(P5·P6·P8) */
export function ReadAloud({text, onSpeaking, testID = 'read-aloud'}: {text: string; onSpeaking?: (mine: boolean) => void; testID?: string}) {
  const a = useReadAloudAction(text, onSpeaking);
  if (!a.allowed) {
    return null;
  }
  return (
    <View testID={testID} style={styles.wrap}>
      <Button kind="secondary" size="inline" icon="icon-speaker" label={a.label} loading={a.busy} onPress={a.onPress} style={styles.center} />
      <ReadAloudNotice notice={a.notice} />
    </View>
  );
}

// 휴대폰의 글자 읽기(TTS) 설정. 열 수 없으면 앱 설정이라도 연다
function openTtsSettings() {
  const fallback = () => Linking.openSettings().catch(() => {});
  if (Platform.OS === 'android') {
    Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(fallback);
  } else {
    fallback();
  }
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', gap: 8},
  center: {alignSelf: 'center'},
  box: {alignSelf: 'stretch', gap: 8, backgroundColor: ds.color.card, borderRadius: ds.radius.card, borderWidth: 2, borderColor: ds.color.line, padding: 16},
  line: {textAlign: 'center'},
});
