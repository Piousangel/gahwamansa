import React from 'react';
import {Platform, Text as RNText} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {useScreenTitleRef} from '../screenTitle';
import {roleText, type TextRole, type TextTone} from './roles';
import {pickLayout, useAudience, type LayoutOnlyStyle} from './audience';

export type TextProps = {
  role: TextRole;
  /** 화면용 tone(본문·보조·제목 계열). onAction·action·info 는 Button·BackLink·Banner 안에서만(R-01·R-06·R-08) */
  tone?: TextTone;
  children: React.ReactNode;
  /** 레이아웃만(margin·align·flex). 크기·색·굵기·높이는 role·tone 으로만 */
  style?: LayoutOnlyStyle;
  accessibilityRole?: 'header' | 'text' | 'none';
  accessibilityLabel?: string;
  testID?: string;
  nativeID?: string;
  /**
   * 말줄임 예외(SUMMARY 2-4). 원칙은 줄바꿈이고 numberOfLines prop 은 없다.
   * 예외 3가지(낱말 칸·브랜드 버튼·번호 칸)만 이유를 적어 쓴다 — 화면(features/·app/)에서 쓰면 lint 경고·dsBaseline 이 센다(#31).
   */
  ellipsisException?: {lines: number; reason: 'wordCell' | 'brandButton' | 'numberCell'};
};

/** v4 글자. 크기·줄높이·굵기·색·확대 상한은 역할(role)과 audience 로 정해진다(화면은 숫자를 고르지 않음). */
export function Text({role, tone = 'default', children, style, accessibilityRole, accessibilityLabel, testID, nativeID, ellipsisException}: TextProps) {
  const audience = useAudience();
  const r = roleText(role, audience, tone);
  const titleRef = useScreenTitleRef(accessibilityRole === 'header');
  // Android 는 글자에 WJ 가 섞이므로 화면 읽기에는 원문을 준다(Text20 과 같은 규칙)
  const label = accessibilityLabel ?? (Platform.OS === 'android' && typeof children === 'string' ? children : undefined);
  return (
    <RNText
      ref={titleRef}
      {...koreanTextProps}
      testID={testID}
      nativeID={nativeID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      maxFontSizeMultiplier={r.maxFontSizeMultiplier}
      numberOfLines={ellipsisException?.lines}
      style={[r.style, pickLayout(style)]}>
      {keepAllChildren(children)}
    </RNText>
  );
}

/** 화면 제목(level 1 = title, 화면당 1개)·섹션 제목(level 2 = heading). 머리글 역할이 자동으로 붙고 Screen 첫 포커스 대상이 된다 */
export function Heading({level, children, style, testID}: {level: 1 | 2; children: React.ReactNode; style?: LayoutOnlyStyle; testID?: string}) {
  return (
    <Text role={level === 1 ? 'title' : 'heading'} accessibilityRole="header" style={style} testID={testID}>
      {children}
    </Text>
  );
}
