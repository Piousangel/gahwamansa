import React, {createContext, useContext} from 'react';
import type {TextStyle} from 'react-native';
import type {Audience} from './roles';

// 어르신·자녀 화면 구분. 크기·높이·보조 색은 audience 로 정해진다(SUMMARY 2-1, 화면은 숫자를 고르지 않음).
// 기본은 어르신(더 큰 쪽) — 자녀 화면 묶음은 <AudienceProvider value="child"> 로 감싼다.
const Ctx = createContext<Audience>('elder');

export function AudienceProvider({value, children}: {value: Audience; children: React.ReactNode}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudience(): Audience {
  return useContext(Ctx);
}

/** 화면이 Text·Button 에 넘길 수 있는 레이아웃 키(SUMMARY 3절 '타입'). 크기·색·굵기·높이는 role·tone·kind 로만 */
export const LAYOUT_KEYS = [
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'alignSelf', 'textAlign', 'flex', 'flexGrow', 'flexShrink', 'flexBasis',
] as const;
type LayoutKey = (typeof LAYOUT_KEYS)[number];

/**
 * 레이아웃만 받는 style 타입. 나머지 TextStyle 키는 never 라서 객체 리터럴뿐 아니라
 * StyleSheet.create 결과·TextStyle 변수로 넘겨도 fontSize·color·height 가 있으면 타입 에러(PR #29 리뷰 H1).
 */
export type LayoutOnlyStyle = Pick<TextStyle, LayoutKey> & {[K in Exclude<keyof TextStyle, LayoutKey>]?: never};

/** 런타임에서도 레이아웃 키만 골라 쓴다(타입을 as 로 뚫어도 역할 값을 덮지 못하게). 버린 키는 개발 중 경고 */
export function pickLayout(style: LayoutOnlyStyle | undefined): Pick<TextStyle, LayoutKey> | undefined {
  if (!style) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(style)) {
    if ((LAYOUT_KEYS as readonly string[]).includes(k)) {
      out[k] = v;
    } else {
      dropped.push(k);
    }
  }
  if (dropped.length && __DEV__) {
    console.warn(`[DS] style 에서 레이아웃이 아닌 키를 버렸어요: ${dropped.join(', ')} — role·tone·kind 로 고르세요.`);
  }
  return out as Pick<TextStyle, LayoutKey>;
}
