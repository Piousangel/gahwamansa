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

/** Text·Button 의 style 은 레이아웃 속성만(SUMMARY 3절 '타입': 글자 크기·색·굵기·높이를 style 로 우회하지 못하게) */
export type LayoutOnlyStyle = Pick<
  TextStyle,
  | 'margin' | 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight' | 'marginHorizontal' | 'marginVertical'
  | 'alignSelf' | 'textAlign' | 'flex' | 'flexGrow' | 'flexShrink' | 'flexBasis'
>;
