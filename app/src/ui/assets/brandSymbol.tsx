import React from 'react';
import {SvgXml} from 'react-native-svg';

// 브랜드 심볼 평면판(D안: 살구 인장 '家' + 옛날 사진, DECISIONS 2026-11-17). 앱 안에서는 평면판만 쓴다.
// 원본: design-system/assets/brand/symbol-flat.svg — 바뀌면 아래 문자열을 그 파일 내용으로 그대로 바꾼다(테스트가 같은지 확인).
export const BRAND_SYMBOL_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img"><title>가화만사성 심볼 평면판(앱 안)</title><g transform="translate(4 4.6) scale(0.86)">\n  <g transform="rotate(11 42.5 21.5)"><rect x="24" y="0" width="37" height="43" rx="2.6" fill="#FFFFFF" stroke="#4E2F14" stroke-width="2"/>\n    <rect x="27.5" y="3.5" width="30" height="29" rx="1.2" fill="#CFE6F7"/><circle cx="46.7" cy="12.8" r="5" fill="#FFC93C"/>\n    <path d="M27.5 24.4 Q38 17.4 47.3 21.5 Q53.3 19.4 57.5 20.9 L57.5 32.5 L27.5 32.5 Z" fill="#CDEBDD"/></g>\n  <g transform="rotate(-6 23.5 40.5)"><rect x="4" y="23.6" width="39" height="39" rx="13" fill="#C44F2E"/><rect x="4" y="21" width="39" height="39" rx="13" fill="#EE6A44"/>\n    <g transform="translate(8.3 25.3) scale(0.304)" fill="none" stroke="#FFFAF3" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M50 5 L53 15"/><path d="M18 19 L15 32"/><path d="M18 20 L82 20 Q85 21 81 31"/><path d="M30 39 L70 39"/><path d="M50 39 Q43 50 24 58"/><path d="M40 52 Q57 55 57 70 Q57 86 49 93 L42 88"/><path d="M50 64 Q40 73 23 79"/><path d="M53 75 Q42 86 22 93"/><path d="M76 54 Q70 61 60 66"/><path d="M58 71 Q70 84 86 93"/></g></g></g></svg>`;

export function BrandSymbol({size = 48}: {size?: number}) {
  return <SvgXml testID="brand-symbol" xml={BRAND_SYMBOL_XML} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no" />;
}
