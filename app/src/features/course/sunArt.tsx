import React from 'react';
import {SvgXml} from 'react-native-svg';

// 해님 그림(design-system/assets/character 사본 문자열). 그림을 직접 그리지 않는다.
// TODO(공용 에셋): 다른 줄이 해님 에셋을 ui/assets 로 옮기면 그쪽을 쓰고 이 파일을 지운다.
// 해님 규칙(DECISIONS Gemini 권고 + v15 검토): 말은 첫 만남·완료·오류만, 하트 금지.

// P7 완료: state-done.svg 에서 작은 하트(소품)만 뺀 판(시안 P7_done v16과 같음). 반짝이·살구색 혀는 유지.
const DONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120" color="#4E2F14"><path d="M30 24Q31.7 32.3 40 34Q31.7 35.7 30 44Q28.3 35.7 20 34Q28.3 32.3 30 24Z" fill="#F59E0B"/><path d="M131 22Q132.36 28.64 139 30Q132.36 31.36 131 38Q129.64 31.36 123 30Q129.64 28.64 131 22Z" fill="#F59E0B"/><path d="M124 88Q125.02 92.98 130 94Q125.02 95.02 124 100Q122.98 95.02 118 94Q122.98 92.98 124 88Z" fill="#F59E0B"/><g transform="translate(39.2 23.2) scale(0.85)"><path d="M85 48L92 48M74.16 74.16L77.34 77.34M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/><circle cx="48" cy="48" r="28" fill="#FFC93C" stroke="currentColor" stroke-width="4"/><path d="M33 46Q38 38.5 43 46M53 46Q58 38.5 63 46" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 53.5H56A8 8 0 0 1 40 53.5Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M44.5 60.7Q48 55.8 51.5 60.7Z" fill="#FF9E7A"/></g></svg>`;

// P8 응원: 시안 P8_cheer 대화상자 위 해님(웃는 눈 + 닫힌 미소, 하트 없음). sun-cheer.svg(하트를 안음)는 쓰지 않는다.
const SMILE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" color="#4E2F14"><path d="M85 48L92 48M48 85L48 92M21.84 74.16L18.66 77.34M11 48L4 48M21.84 21.84L18.66 18.66M48 11L48 4M74.16 21.84L77.34 18.66" fill="none" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/><circle cx="48" cy="48" r="28" fill="#FFC93C" stroke="currentColor" stroke-width="4"/><path d="M33 46Q38 38.5 43 46M53 46Q58 38.5 63 46" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 54Q48 61 56 54" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const hidden = {accessibilityElementsHidden: true, importantForAccessibility: 'no' as const};

export function SunDone({width = 160}: {width?: number}) {
  return <SvgXml testID="sun-done" xml={DONE} width={width} height={(width * 120) / 160} {...hidden} />;
}

export function SunSmile({size = 88}: {size?: number}) {
  return <SvgXml testID="sun-smile" xml={SMILE} width={size} height={size} {...hidden} />;
}
