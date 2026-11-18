import React from 'react';
import {Linking, StyleSheet, Text, type StyleProp, type TextStyle} from 'react-native';
import {Text20} from './Text20';
import {color} from './tokens';

export type LegalLink = {label: string; url: string | null};

// 약관 한 줄(감사 M7·디자인 9절, 리뷰 M2 구조).
// - 주소가 없으면(⑥a 방침 호스팅 전) 일반 글자: 누를 수 없는데 링크처럼 보이면 안 된다.
// - 주소가 있으면 문장 안 두 낱말을 굵게 + 밑줄, 읽기 역할 '링크'. 누름 영역은 줄 높이 48(9절: 문장 안 링크라 64 대신 줄 높이 + 여백).
//   TalkBack 은 문장 안 링크를 따로 포커스하지 않으므로 문장 하나를 읽고 '링크 열기' 동작(accessibilityActions)으로 각각 연다(문장 → 이용약관 → 처리방침 순).
// - 여는 곳은 호출부가 정한다(onOpen). 기본은 밖 브라우저 — TODO(L4-2 useInAppWeb 병합 뒤): 앱 안 웹 화면(AP-06)으로 넘긴다.
// ui 는 문구를 모른다 — 문장·낱말·주소는 호출부가 넘긴다.
export const LEGAL_LINK_LINE_H = 48;

export function LegalText({
  text,
  links,
  style,
  testID,
  onOpen = url => {
    Linking.openURL(url).catch(() => {});
  },
}: {
  text: string;
  links: LegalLink[];
  style?: StyleProp<TextStyle>;
  testID?: string;
  onOpen?: (url: string, label: string) => void;
}) {
  const live = links.filter((l): l is {label: string; url: string} => !!l.url && text.includes(l.label));
  if (live.length === 0) {
    return (
      <Text20 testID={testID} style={style}>
        {text}
      </Text20>
    );
  }
  const parts: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    const h = live.map(l => ({l, at: rest.indexOf(l.label)})).filter(x => x.at >= 0).sort((a, b) => a.at - b.at)[0];
    if (!h) {
      parts.push(rest);
      break;
    }
    if (h.at > 0) {
      parts.push(rest.slice(0, h.at));
    }
    parts.push(
      <Text key={i++} accessibilityRole="link" onPress={() => onOpen(h.l.url, h.l.label)} style={styles.link}>
        {h.l.label}
      </Text>,
    );
    rest = rest.slice(h.at + h.l.label.length);
  }
  return (
    <Text20
      testID={testID}
      style={[style, styles.tall]}
      accessibilityLabel={text}
      accessibilityActions={live.map((l, n) => ({name: `link-${n}`, label: l.label}))}
      onAccessibilityAction={e => {
        const n = Number(e.nativeEvent.actionName.replace('link-', ''));
        const l = live[n];
        if (l) {
          onOpen(l.url, l.label);
        }
      }}>
      {parts}
    </Text20>
  );
}

const styles = StyleSheet.create({
  link: {fontWeight: 'bold', textDecorationLine: 'underline', color: color.inkTitle},
  tall: {lineHeight: LEGAL_LINK_LINE_H},
});
