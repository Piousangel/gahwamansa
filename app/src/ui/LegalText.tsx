import React from 'react';
import {Linking, StyleSheet, Text, type StyleProp, type TextStyle} from 'react-native';
import {Text20} from './Text20';
import {color} from './tokens';
import {roleText, type Audience} from './ds/roles';
import {keepAllChildren, koreanTextProps} from './koreanText';

export type LegalLink = {
  label: string;
  url: string | null;
  /** 호출부가 여는 곳을 고를 때 쓰는 이름(예: terms·privacy) */ key?: string;
  /** 화면 읽기 이름(보이는 낱말이 줄임말일 때. 예: 짧은 고지 '약관' → '이용약관', #274 법률 판정). 없으면 label */
  a11yLabel?: string;
};

// 약관 한 줄(감사 M7·디자인 9절, 리뷰 M2 구조).
// - 주소가 없으면(⑥a 방침 호스팅 전) 일반 글자: 누를 수 없는데 링크처럼 보이면 안 된다.
// - 주소가 있으면 문장 안 두 낱말을 굵게 + 밑줄, 읽기 역할 '링크'. 누름 영역은 줄 높이 48(9절: 문장 안 링크라 64 대신 줄 높이 + 여백).
//   TalkBack 은 문장 안 링크를 따로 포커스하지 않으므로 문장 하나를 읽고 '링크 열기' 동작(accessibilityActions)으로 각각 연다(문장 → 이용약관 → 처리방침 순).
// - 여는 곳은 호출부가 정한다(onOpen). 화면들은 shared/legalLinks useLegalOpen(앱 안 웹 화면, AU-07)을 넘긴다. 기본(넘기지 않으면)은 밖 브라우저.
// ui 는 문구를 모른다 — 문장·낱말·주소는 호출부가 넘긴다.
export const LEGAL_LINK_LINE_H = 48;

function DsSub({audience, children, ...rest}: React.ComponentProps<typeof Text> & {audience: Audience}) {
  const r = roleText('sub', audience, 'muted');
  return (
    <Text {...koreanTextProps} {...rest} maxFontSizeMultiplier={r.maxFontSizeMultiplier} style={r.style}>
      {keepAllChildren(children)}
    </Text>
  );
}

export function LegalText({
  text,
  links,
  style,
  testID,
  onOpen = url => {
    Linking.openURL(url).catch(() => {});
  },
  audience,
}: {
  text: string;
  links: LegalLink[];
  style?: StyleProp<TextStyle>;
  testID?: string;
  onOpen?: (url: string, label: string, key?: string) => void;
  /** v4 화면(ui/ds): 문장은 sub 역할·보조색, 링크는 link 역할(400 + 밑줄, C0 v4 시안). 주면 style 은 쓰지 않는다 */
  audience?: Audience;
}) {
  // v4: 역할 값으로 그리는 글자(크기·색·확대 상한은 roleText 가 정한다)
  const linkStyle = audience ? [roleText('link', audience).style, styles.dsLink] : styles.link;
  const live = links.filter((l): l is LegalLink & {url: string} => !!l.url && text.includes(l.label));
  if (live.length === 0) {
    return audience ? (
      <DsSub audience={audience} testID={testID} accessibilityLabel={text}>
        {text}
      </DsSub>
    ) : (
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
      <Text key={i++} accessibilityRole="link" accessibilityLabel={h.l.a11yLabel} onPress={() => onOpen(h.l.url, h.l.label, h.l.key)} style={linkStyle}>
        {h.l.label}
      </Text>,
    );
    rest = rest.slice(h.at + h.l.label.length);
  }
  const a11y = {
    accessibilityLabel: text,
    accessibilityActions: live.map((l, n) => ({name: `link-${n}`, label: l.a11yLabel ?? l.label})),
    onAccessibilityAction: (e: {nativeEvent: {actionName: string}}) => {
      const l = live[Number(e.nativeEvent.actionName.replace('link-', ''))];
      if (l) {
        onOpen(l.url, l.label, l.key);
      }
    },
  };
  if (audience) {
    return (
      <DsSub audience={audience} testID={testID} {...a11y}>
        {parts}
      </DsSub>
    );
  }
  return (
    <Text20
      testID={testID}
      style={[style, styles.tall]}
      accessibilityLabel={text}
      accessibilityActions={live.map((l, n) => ({name: `link-${n}`, label: l.a11yLabel ?? l.label}))}
      onAccessibilityAction={e => {
        const n = Number(e.nativeEvent.actionName.replace('link-', ''));
        const l = live[n];
        if (l) {
          onOpen(l.url, l.label, l.key);
        }
      }}>
      {parts}
    </Text20>
  );
}

const styles = StyleSheet.create({
  link: {fontWeight: 'bold', textDecorationLine: 'underline', color: color.inkTitle},
  tall: {lineHeight: LEGAL_LINK_LINE_H},
  dsLink: {textDecorationLine: 'underline'},
});
