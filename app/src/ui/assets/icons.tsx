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
  // U0 공용 컴포넌트(시트 닫기·배너·말풍선 읽어 주기)
  'icon-close': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  'icon-warning': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5l8 14.5H4z"/><path d="M12 10v4"/><path d="M12 16.5h.01"/></svg>`,
  'icon-wifi-off': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.13 15.4A5 5 0 0 1 14.87 15.4"/><path d="M6.55 11.72A9.5 9.5 0 0 1 17.45 11.72"/><path d="M3.97 8.03A14 14 0 0 1 20.03 8.03"/><path d="M12 19.5h.01"/><path d="M4 4l16 16"/></svg>`,
  'icon-check': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  'icon-info': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8.2h.01"/><path d="M12 12v4"/></svg>`,
  'icon-speaker': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5h3l4-3.5v12l-4-3.5H6z"/><path d="M16.18 8.82A4.5 4.5 0 0 1 16.18 15.18"/></svg>`,
  // 첫 화면 띠 '가족이 보낸 번호가 있어요'(시안 FS_link)
  'icon-mail': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>`,
  // 응원 시트 사물 아이콘(디자인 #92, 분류 b 아이콘+글자)
  'icon-sun': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="해">
  <title>해</title>
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/>
</svg>`,
  'icon-teacup': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="찻잔">
  <title>찻잔</title>
  <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/>
  <path d="M16 10h2a2 2 0 0 1 0 4h-2"/>
  <path d="M8 3c0 1.2 1.2 1.2 1.2 2.6M12 3c0 1.2 1.2 1.2 1.2 2.6"/>
</svg>`,
  'icon-sprout': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="새싹">
  <title>새싹</title>
  <path d="M12 20v-8"/>
  <path d="M12 12c-4 0-6-3-6-6 4 0 6 2 6 6z"/>
  <path d="M12 14c4 0 6-3 6-6-4 0-6 2-6 6z"/>
</svg>`,
  'icon-note': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="쪽지">
  <title>쪽지</title>
  <path d="M6 4h9l3 3v13H6z"/>
  <path d="M15 4v3h3"/>
  <path d="M9 12h6M9 16h6"/>
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
