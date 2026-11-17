import React from 'react';
import {SvgXml} from 'react-native-svg';

// 디자인 시스템 아이콘(design-system/assets/icons/*.svg 사본 문자열, currentColor). 그림을 직접 그리지 않는다.
// 원본이 바뀌면 문자열만 바꾼다.
const XML = {
  'icon-photo': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="사진">
  
  <rect x="4" y="4" width="16" height="16" rx="4"/>
  <path d="M8.5 8h.01"/>
  <path d="M4 16.5l4.5-4.5 4 4 2.5-2.5 5 5"/>
</svg>`,
  'icon-pencil': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="따라 쓰기">
  
  <path d="M4.5 19.5L6.06 13.98L14.54 5.5L18.5 9.46L10.02 17.94z"/>
  <path d="M6.06 13.98L10.02 17.94"/>
</svg>`,
  'icon-family': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="가족">
  
  <circle cx="7.5" cy="8" r="2.8"/>
  <path d="M4 19.5a3.5 3.5 0 0 1 7 0"/>
  <circle cx="16.5" cy="8" r="2.8"/>
  <path d="M13 19.5a3.5 3.5 0 0 1 7 0"/>
</svg>`,
} as const;
export type IconName = keyof typeof XML;

// 장식 아이콘: 화면 읽기에서 숨긴다(정보는 옆 글이 전달).
export function Icon({name, size = 24, color}: {name: IconName; size?: number; color: string}) {
  return (
    <SvgXml
      testID={name}
      xml={XML[name]}
      width={size}
      height={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
