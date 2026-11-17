import React from 'react';
import {SvgXml} from 'react-native-svg';

// 브랜드 심볼(얼굴 없는 해 + 폴라로이드). 원본: design-system/assets/symbol-sun-polaroid.svg (이 폴더에 사본).
// 원본이 바뀌면 아래 문자열을 그 파일 내용으로 바꾼다(그림을 직접 그리지 않음).
const XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" color="#4E2F14" role="img"><title>가화만사성</title><g transform="rotate(-5 32 32)"><rect x="11" y="5" width="42" height="54" rx="3" fill="#FFFFFF" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><rect x="15" y="9" width="34" height="31" rx="1" fill="#F1E4D4"/><path d="M44.50 24.50L47.00 24.50M40.84 33.34L41.90 34.40M32.00 37.00L32.00 39.50M23.16 33.34L22.10 34.40M19.50 24.50L17.00 24.50M23.16 15.66L22.10 14.60M32.00 12.00L32.00 9.50M40.84 15.66L41.90 14.60" fill="none" stroke="#F59E0B" stroke-width="3.6" stroke-linecap="round"/><circle cx="32" cy="24.5" r="8.5" fill="#FFC93C" stroke="currentColor" stroke-width="3"/></g></svg>`;

export function BrandSymbol({size = 48}: {size?: number}) {
  return <SvgXml testID="brand-symbol" xml={XML} width={size} height={size} color="#4E2F14" accessibilityElementsHidden importantForAccessibility="no" />;
}
