import React from 'react';
import {SvgXml} from 'react-native-svg';
import {tokensV4} from '../tokensV4';

// 앨범 장식·도장 SVG(design-system/assets 사본 문자열). 그림을 직접 그리지 않는다. 원본이 바뀌면 문자열만 바꾼다.
const STAMPS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" color="#4E2F14" role="img"><circle cx="48" cy="48" r="46" fill="#FFFFFF" stroke="#D8C6B0" stroke-width="2.5"/><g transform="rotate(-4 48 48)"><g transform="translate(48 48) scale(.86) translate(-48 -48)"><path d="M85 48L92 48M74.16 74.16L77.34 77.34M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="48" r="28" fill="#FFC93C" stroke="currentColor" stroke-width="5"/><circle cx="38" cy="44" r="4.6" fill="currentColor"/><circle cx="58" cy="44" r="4.6" fill="currentColor"/><path d="M40 54Q48 61 56 54" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></g></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" color="#4E2F14" role="img"><circle cx="48" cy="48" r="46" fill="#FFFFFF" stroke="#D8C6B0" stroke-width="2.5"/><g transform="rotate(3 48 48)"><g transform="translate(48 48) scale(.86) translate(-48 -48)"><path d="M85 48L92 48M74.16 74.16L77.34 77.34M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="48" r="28" fill="#FFC93C" stroke="currentColor" stroke-width="5"/><circle cx="38" cy="44" r="4.6" fill="currentColor"/><circle cx="58" cy="44" r="4.6" fill="currentColor"/><path d="M40 54Q48 61 56 54" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></g></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" color="#4E2F14" role="img"><circle cx="48" cy="48" r="46" fill="#FFFFFF" stroke="#D8C6B0" stroke-width="2.5"/><g transform="rotate(5 48 48)"><g transform="translate(48 48) scale(.86) translate(-48 -48)"><path d="M85 48L92 48M74.16 74.16L77.34 77.34M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="48" r="28" fill="#FFC93C" stroke="currentColor" stroke-width="5"/><circle cx="38" cy="44" r="4.6" fill="currentColor"/><circle cx="58" cy="44" r="4.6" fill="currentColor"/><path d="M40 54Q48 61 56 54" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></g></svg>`,
];
const TAPE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 28" width="96" height="28" color="#EADBC4" aria-hidden="true"><g transform="translate(1.44 .42) scale(.97)"><path d="M92 0L96 3.5L92 7L96 10.5L92 14L96 17.5L92 21L96 24.5L92 28L4 28L0 24.5L4 21L0 17.5L4 14L0 10.5L4 7L0 3.5L4 0Z" fill="currentColor" stroke="#D8C6B0" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 6H86M10 22H86" stroke="#D8C6B0" stroke-width="1.6" stroke-linecap="round" fill="none"/></g></svg>`;
const STITCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 12" width="360" height="12" color="#A67C5A" aria-hidden="true"><path d="M0 6Q6 1 12 6T24 6T36 6T48 6T60 6T72 6T84 6T96 6T108 6T120 6T132 6T144 6T156 6T168 6T180 6T192 6T204 6T216 6T228 6T240 6T252 6T264 6T276 6T288 6T300 6T312 6T324 6T336 6T348 6T360 6" pathLength="360" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="6.5 5.5" stroke-dashoffset="-2.75"/></svg>`;

// 해님 도장(3종 번갈아, 날짜로 고정 선택). 장식이라 화면 읽기에서 숨긴다.
export function SunStamp({variant, size = 44, testID}: {variant: number; size?: number; testID?: string}) {
  return <SvgXml testID={testID} xml={STAMPS[variant % 3]} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no" />;
}

// 스티치 물결 구분선(가로 360 원본을 폭에 맞춰 늘림, 높이 12)
export function Stitch({width}: {width: number | `${number}%`}) {
  return <SvgXml testID="stitch" xml={STITCH} width={width} height={12} preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no" />;
}

// 마스킹테이프(라벨 뒤 장식, 140x41 원본)
export function Tape({width = 140, height = 41, testID}: {width?: number; height?: number; testID?: string}) {
  return <SvgXml testID={testID} xml={TAPE} width={width} height={height} accessibilityElementsHidden importantForAccessibility="no" />;
}

// 큰 인장 '家'(P7 완료, 시안 P7_album_ds4 — 브랜드 심볼 평면판 symbol-flat.svg 의 인장을 떼어 64 칸에 맞춤).
// 색은 토큰에서(brandSeal 면·brandSealDeep 두께·brandSealGlyph 획) — 크리에이티브 디렉션이 바뀌면 토큰만 바꾼다.
// 번짐 원은 연출(P7)이 따로 그린다. 장식이라 화면 읽기에서 숨긴다.
const SEAL_GLYPH = '<path d="M50 5 L53 15"/><path d="M18 19 L15 32"/><path d="M18 20 L82 20 Q85 21 81 31"/><path d="M30 39 L70 39"/><path d="M50 39 Q43 50 24 58"/><path d="M40 52 Q57 55 57 70 Q57 86 49 93 L42 88"/><path d="M50 64 Q40 73 23 79"/><path d="M53 75 Q42 86 22 93"/><path d="M76 54 Q70 61 60 66"/><path d="M58 71 Q70 84 86 93"/>';
function sealXml(): string {
  const c = tokensV4.color;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><rect x="8" y="9" width="48" height="48" rx="15" fill="${c.brandSealDeep}"/><rect x="8" y="7" width="48" height="48" rx="15" fill="${c.brandSeal}"/><g transform="translate(13.3 12.3) scale(0.374)" fill="none" stroke="${c.brandSealGlyph}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${SEAL_GLYPH}</g></svg>`;
}
export function SealStamp({size = 116, testID}: {size?: number; testID?: string}) {
  return <SvgXml testID={testID} xml={sealXml()} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no" />;
}
