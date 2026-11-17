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
  'icon-settings': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="설정">
  
  <path d="M10.42 6.11L10.75 4.1L13.25 4.1L13.58 6.11A6.1 6.1 0 0 1 15.05 6.72L15.05 6.72L16.7 5.53L18.47 7.3L17.28 8.95A6.1 6.1 0 0 1 17.89 10.42L17.89 10.42L19.9 10.75L19.9 13.25L17.89 13.58A6.1 6.1 0 0 1 17.28 15.05L17.28 15.05L18.47 16.7L16.7 18.47L15.05 17.28A6.1 6.1 0 0 1 13.58 17.89L13.58 17.89L13.25 19.9L10.75 19.9L10.42 17.89A6.1 6.1 0 0 1 8.95 17.28L8.95 17.28L7.3 18.47L5.53 16.7L6.72 15.05A6.1 6.1 0 0 1 6.11 13.58L6.11 13.58L4.1 13.25L4.1 10.75L6.11 10.42A6.1 6.1 0 0 1 6.72 8.95L6.72 8.95L5.53 7.3L7.3 5.53L8.95 6.72A6.1 6.1 0 0 1 10.42 6.11z"/>
  <circle cx="12" cy="12" r="2.6"/>
</svg>`,
  'icon-chevron-right': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="자세히 보기">
  
  <path d="M9 5l7 7-7 7"/>
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
