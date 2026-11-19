import React from 'react';
import {Share, StyleSheet, View} from 'react-native';
import {Card, DsScreen, Heading, Text} from '../../ui/ds';
import {copy} from '../../copy/copy';
import {formatCode} from '../../ui/codeInputLogic';

// 번호 보여 주기(역할에 묶이지 않음): 큰 숫자 3자리씩 + 보내기(시스템 공유: 카톡·문자 등).
// 빌드 2 "부모님 먼저" 흐름에서도 문구만 바꿔 재사용한다.
// v4(지금 쓰는 곳은 C2 재연결 번호뿐, V4-INDEX '시안 없음, 토큰 효과만'): 부품만 ui/ds — 제목 Heading, 번호는 C3 번호 카드와 같은 모양(Card outlined + display),
// Dock 주 = 보내기, 보조 = 돌아가기. audience 는 호출 스택(자녀 스택 루트)에서 받는다.
type Props = {
  code: string;
  title: string;
  lines: string[];
  shareMessage: string; // {번호} 자리에 3자리씩 띄운 번호가 들어간다
  sendLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  top?: React.ReactNode; // 이전 바 등
  onShare?: () => void; // 보내기를 눌렀을 때(계측, 공유 창을 열기 전)
};

export function CodeShow({code, title, lines, shareMessage, sendLabel, primaryLabel, onPrimary, top, onShare}: Props) {
  const shown = formatCode(code);
  const send = () => {
    onShare?.();
    Share.share({message: shareMessage.split('{번호}').join(shown)}).catch(() => {});
  };
  const a11y = copy.code.show_a11y.split('{앞}').join(code.slice(0, 3).split('').join(' ')).split('{뒤}').join(code.slice(3).split('').join(' '));
  return (
    <DsScreen
      variant="form"
      header={
        <>
          {top}
          <Heading level={1}>{title}</Heading>
        </>
      }
      dock={{primary: {label: sendLabel, onPress: send}, secondary: {label: primaryLabel, onPress: onPrimary}}}>
      <Card tone="outlined" testID="code-show">
        <View accessible accessibilityLabel={a11y} style={styles.center}>
          <Text role="display">{shown}</Text>
        </View>
      </Card>
      {lines.map(l => (
        <Text key={l} role="bodyLg">
          {l}
        </Text>
      ))}
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  center: {alignItems: 'center', alignSelf: 'stretch'},
});
