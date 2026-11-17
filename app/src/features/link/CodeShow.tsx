import React from 'react';
import {Share, StyleSheet, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {Screen} from '../../ui/Screen';
import {BigButton} from '../../ui/BigButton';
import {copy} from '../../copy/copy';
import {formatCode} from '../../ui/codeInputLogic';
import {color, radius} from '../../ui/tokens';

// 번호 보여 주기(역할에 묶이지 않음): 큰 숫자 3자리씩 + 보내기(시스템 공유: 카톡·문자 등).
// 빌드 2 "부모님 먼저" 흐름에서도 문구만 바꿔 재사용한다.
type Props = {
  code: string;
  title: string;
  lines: string[];
  shareMessage: string; // {번호} 자리에 3자리씩 띄운 번호가 들어간다
  sendLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  top?: React.ReactNode; // 이전 바 등
};

export function CodeShow({code, title, lines, shareMessage, sendLabel, primaryLabel, onPrimary, top}: Props) {
  const shown = formatCode(code);
  const send = () => {
    Share.share({message: shareMessage.split('{번호}').join(shown)}).catch(() => {});
  };
  // 보내기·다음 버튼은 하단 고정 영역(내비게이션 바 위)
  return (
    <Screen
      top={top}
      bottom={
        <>
          <BigButton label={sendLabel} onPress={send} />
          <BigButton variant="secondary" label={primaryLabel} onPress={onPrimary} />
        </>
      }>
      <Text20 size={28} weight="bold">{title}</Text20>
      <View style={styles.box} accessible accessibilityLabel={copy.code.show_a11y.split('{앞}').join(code.slice(0, 3).split('').join(' ')).split('{뒤}').join(code.slice(3).split('').join(' '))}>
        <Text20 size={44} weight="bold" style={styles.code}>{shown}</Text20>
      </View>
      {lines.map(l => (
        <Text20 key={l}>{l}</Text20>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {borderWidth: 3, borderColor: color.line, borderRadius: radius.card, backgroundColor: color.card, padding: 16, marginVertical: 12, alignItems: 'center'},
  code: {letterSpacing: 4},
});
