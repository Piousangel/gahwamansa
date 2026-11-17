import React from 'react';
import {SvgXml} from 'react-native-svg';

// 해님 캐릭터 SVG(design-system/assets/character 사본, 볼터치 없음). 직접 그리지 않는다. 원본이 바뀌면 문자열만 바꾼다.
// 56 이상 전용. 40 이하는 SunStamp(album.tsx)를 쓴다(원본 주석 "40px 이하는 sun-stamp 사용").
const RAYS = `<path d="M85 48L92 48M74.16 74.16L77.34 77.34M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/>`;
const FACE = `<circle cx="48" cy="48" r="28" fill="#FFC93C" stroke="currentColor" stroke-width="4"/>`;
const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" color="#4E2F14">`;

const XML = {
  'sun-wave': `${open}<path d="M85 48L92 48M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/>${FACE}<circle cx="38" cy="44" r="3.8" fill="currentColor"/><circle cx="58" cy="44" r="3.8" fill="currentColor"/><path d="M40 54Q48 61 56 54" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="76" cy="72" r="7.5" fill="#FFC93C" stroke="currentColor" stroke-width="4"/><path d="M86 61.5L90 57.5M89 70H93" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'sun-happy': `${open}${RAYS}${FACE}<path d="M33 46Q38 38.5 43 46M53 46Q58 38.5 63 46" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 53.5H56A8 8 0 0 1 40 53.5Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M44.5 60.7Q48 55.8 51.5 60.7Z" fill="#FF9E7A"/></svg>`,
  'sun-worry': `${open}${RAYS}${FACE}<circle cx="38" cy="45" r="3.8" fill="currentColor"/><circle cx="58" cy="45" r="3.8" fill="currentColor"/><path d="M31 38.5L43 34.5M65 38.5L53 34.5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 59Q48 54.5 55 59" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
} as const;
export type SunArt = keyof typeof XML;

/** 해님은 장식(말풍선 글자가 정보). 화면 읽기에서 숨긴다. */
export function Sun({art, size}: {art: SunArt; size: number}) {
  return <SvgXml xml={XML[art]} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no" />;
}
