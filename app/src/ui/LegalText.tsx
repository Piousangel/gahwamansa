import React from 'react';
import {Linking, StyleSheet, Text, type StyleProp, type TextStyle} from 'react-native';
import {Text20} from './Text20';
import {color} from './tokens';

export type LegalLink = {label: string; url: string | null};

// 약관 한 줄(감사 M7): 문장 안 '이용약관'·'개인정보 처리방침'을 링크 모양(굵게 + 밑줄, 읽기 역할 링크)으로, 누르면 주소를 연다.
// 주소가 아직 없으면(⑥a 방침 호스팅 전) 누를 수 없는데 링크처럼 보이면 안 되므로 일반 글자로 둔다.
// ui 는 문구를 모른다 — 문장·낱말·주소는 호출부가 넘긴다.
export function LegalText({text, links, style, testID}: {text: string; links: LegalLink[]; style?: StyleProp<TextStyle>; testID?: string}) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    const hits = links
      .map(l => ({l, at: rest.indexOf(l.label)}))
      .filter(h => h.at >= 0 && h.l.url)
      .sort((a, b) => a.at - b.at);
    const h = hits[0];
    if (!h) {
      parts.push(rest);
      break;
    }
    if (h.at > 0) {
      parts.push(rest.slice(0, h.at));
    }
    const url = h.l.url as string;
    parts.push(
      <Text
        key={i++}
        accessibilityRole="link"
        onPress={() => {
          Linking.openURL(url).catch(() => {});
        }}
        style={styles.link}>
        {h.l.label}
      </Text>,
    );
    rest = rest.slice(h.at + h.l.label.length);
  }
  // 링크가 없으면 문자열 하나로(Text20 이 Android 읽기 라벨·어절 줄바꿈을 그대로 붙이게)
  return (
    <Text20 testID={testID} style={style}>
      {parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts}
    </Text20>
  );
}

const styles = StyleSheet.create({
  link: {fontWeight: 'bold', textDecorationLine: 'underline', color: color.inkTitle},
});
