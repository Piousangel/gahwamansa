import React, {useContext, useEffect, useRef, useState} from 'react';
import {Linking, Platform, Pressable, StyleSheet, View} from 'react-native';
import {NavigationContext} from '@react-navigation/native';
import {Text20} from '../../ui/Text20';
import {Icon} from '../../ui/assets/icons';
import {SmallButton} from '../../ui/SmallButton';
import {color, radius, size} from '../../ui/tokens';
import {getMediaVolume, useReadAloud} from '../../audio';
import {copy} from '../../copy/copy';

const t = copy.tts;

// AP-03 읽어 주기(시안 PX_read_aloud, 문구 copy tts.* WR-03).
// - 위치: 읽을 글 바로 아래 가운데 한 개(P4 회상 질문·P5 질문·P6 낱말·P8 응원). 자동으로 읽지 않는다(공공장소 소리 방지).
// - 화면 읽기(TalkBack) 켜짐이면 숨김(R16, readAloudAllowed 한 곳). 아이콘만 쓰지 않음. 높이 64, 글자 24(확대 상한 1.5).
// - 상태: 기본 '읽어 주세요' → 읽는 중 '멈추기'(다시 누르면 멈춤) → 다 읽으면 저절로 기본.
// - 화면을 떠나면 멈춘다(재검토 R1): native-stack 은 다음 화면으로 갈 때 이 화면을 언마운트하지 않으므로 blur 에서 멈춘다.
// - 예외 3상태(누른 뒤): 한국어 음성 없음 = 안내 상자 + '휴대폰 설정 열기', 휴대폰 소리 0 = 한 줄, 읽기 실패 = 한 줄.
type Notice = null | 'no_korean' | 'muted' | 'failed';
const FONT_MAX = 1.5;

/** 읽어 주기 문장 만들기(copy tts.read 틀). 화면은 이것으로 읽을 글을 만든다 */
export const ttsText = {
  photo: (qs: string[]) => t.read.photo.split('{질문1}').join(qs[0] ?? '').split('{질문2}').join(qs[1] ?? '').trim(),
  question: (prompt: string, a: string, b: string) =>
    t.read.question.split('{질문}').join(prompt).split('{선택지1}').join(a).split('{선택지2}').join(b),
  word: (word: string, letters: string[]) => t.read.word.split('{낱말}').join(word).split('{글자들}').join(letters.join(', ')),
  cheer: (text: string) => t.read.cheer.split('{응원}').join(text),
};

export function ReadAloud({text, onSpeaking, testID = 'read-aloud'}: {text: string; onSpeaking?: (mine: boolean) => void; testID?: string}) {
  const {allowed, speaking, speak, stop} = useReadAloud();
  const [notice, setNotice] = useState<Notice>(null);
  const started = useRef(false); // 이 버튼이 시작한 읽기인가(다른 화면이 읽는 중이면 '멈추기'로 바꾸지 않음)
  const mine = speaking && started.current;
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
    return navigation.addListener('blur', () => {
      if (started.current) {
        started.current = false;
        stopRef.current();
      }
    });
  }, [navigation]);

  if (!allowed) {
    return null;
  }
  const press = async () => {
    if (mine) {
      started.current = false;
      await stop();
      return;
    }
    setNotice(null);
    if ((await getMediaVolume()) === 0) {
      setNotice('muted');
      return;
    }
    started.current = true;
    const r = await speak(text);
    if (r !== 'spoken') {
      started.current = false;
      setNotice(r === 'no_korean_voice' ? 'no_korean' : r === 'blocked' ? null : 'failed');
    }
  };
  return (
    <View testID={testID} style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine ? t.stop : t.button}
        onPress={press}
        style={({pressed}) => [styles.button, pressed ? styles.pressed : null]}>
        <Icon name="icon-speaker" size={28} color={color.action} />
        <Text20 size={24} weight="bold" maxFontSizeMultiplier={FONT_MAX} style={styles.label}>
          {mine ? t.stop : t.button}
        </Text20>
      </Pressable>
      {notice === 'no_korean' ? (
        <View testID="tts-no-korean" accessibilityLiveRegion="polite" style={styles.box}>
          <Text20 size={22} weight="bold" style={styles.boxTitle}>{t.no_korean.title}</Text20>
          <Text20>{t.no_korean.body}</Text20>
          <SmallButton label={t.no_korean.button} onPress={openTtsSettings} />
        </View>
      ) : notice ? (
        <Text20 testID={`tts-${notice}`} accessibilityLiveRegion="polite" style={styles.line}>
          {notice === 'muted' ? t.muted : t.failed}
        </Text20>
      ) : null}
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
  button: {
    minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 20, borderRadius: radius.button, borderWidth: 3, borderColor: color.action, backgroundColor: color.card,
  },
  pressed: {backgroundColor: color.actionSoft},
  label: {color: color.action},
  box: {alignSelf: 'stretch', gap: 8, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 3, borderColor: color.line, padding: 16},
  boxTitle: {color: color.inkTitle},
  line: {color: color.ink, textAlign: 'center'},
});
