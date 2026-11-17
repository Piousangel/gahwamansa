import React from 'react';
import {Image, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {color, radius} from '../../ui/tokens';
import {assetRegistry} from '../../ui/assets/registry';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {copy} from '../../copy/copy';
import {TwoLineButton} from './TwoLineButton';

const f = copy.first;

// 첫 화면(확정: C 구성 + A 질문). 위 심볼+워드마크+한 줄 설명, 가운데 소개 폴라로이드(번들 사진, "AI가 만든 그림"),
// 아래 고정 영역에 질문과 버튼 2개(첫 화면은 하단 40% 규칙 예외). 해님 말 없음. 이전 바 없음.
// 글자를 키우면 한 줄 설명(130%) → 폴라로이드(150%) 순으로 숨겨 버튼을 지킨다.
export function RoleSelect({onChoose}: {onChoose: (role: 'parent' | 'child') => void}) {
  const {fontScale} = useWindowDimensions();
  const showTagline = fontScale < 1.3;
  const showPhoto = fontScale < 1.5;
  return (
    <Screen
      dockMaxRatio={0.6}
      bottom={
        <>
          <Text20 size={28} weight="bold" accessibilityRole="header">{f.question}</Text20>
          <TwoLineButton title={f.parent} sub={f.parent_sub} onPress={() => onChoose('parent')} />
          <TwoLineButton variant="secondary" title={f.child} sub={f.child_sub} onPress={() => onChoose('child')} />
        </>
      }>
      <View style={styles.brand}>
        <BrandSymbol size={44} />
        <Text20 size={32} weight="bold">{f.wordmark}</Text20>
      </View>
      {showTagline ? <Text20>{f.tagline}</Text20> : null}
      {showPhoto ? (
        <View style={styles.polaroid} accessible accessibilityRole="image" accessibilityLabel={f.polaroid_a11y}>
          <Image source={assetRegistry['intro-photo']!} style={styles.photo} resizeMode="cover" />
          <Text20 style={styles.caption} importantForAccessibility="no">{f.polaroid_caption}</Text20>
          <Text20 importantForAccessibility="no">{f.polaroid_ai}</Text20>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {flexDirection: 'row', alignItems: 'center', gap: 12},
  // 폴라로이드: 흰 틀, 약간 기울임(읽는 글자는 틀 안 캡션뿐)
  polaroid: {alignSelf: 'center', width: '82%', backgroundColor: color.card, padding: 12, paddingBottom: 8, borderRadius: radius.chip, transform: [{rotate: '-2deg'}], boxShadow: '0px 6px 14px rgba(92,78,51,0.28)'},
  photo: {width: '100%', aspectRatio: 1152 / 928, borderRadius: 4, backgroundColor: color.paperSoft},
  caption: {color: color.handwrite, marginTop: 8},
});
