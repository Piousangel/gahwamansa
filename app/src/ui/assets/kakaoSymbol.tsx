import React from 'react';
import {SvgXml} from 'react-native-svg';

// 카카오 로그인 공식 심볼(design-system/assets/third-party-login/login-complete-ko.svg 의 말풍선 path 그대로).
// 형태·비율 변경 금지. 색은 카카오 디자인 가이드 규정 #000000(GUIDELINES.md). 화면 읽기에서는 숨김(레이블이 전달).
const PATH = 'M68.001 16.5225C64.4222 16.5225 61.5225 19.0037 61.5225 22.0641C61.5225 24.0312 62.7219 25.7596 64.5292 26.7423L63.9181 29.2113C63.8954 29.285 63.9132 29.364 63.9619 29.4184C63.9975 29.457 64.0461 29.478 64.0931 29.478C64.1337 29.478 64.1742 29.464 64.2082 29.4341L66.834 27.5144C67.2117 27.5723 67.6007 27.6039 67.9994 27.6039C71.5767 27.6039 74.478 25.1226 74.478 22.0623C74.478 19.002 71.5783 16.5225 68.001 16.5225Z';
// path 가 차지하는 영역(61.52~74.48, 16.52~29.48)만 보이게 자른 viewBox(늘리지 않음, 정사각)
const XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="61.5225 16.5225 12.9555 12.9555"><path d="${PATH}" fill="#000000"/></svg>`;

export function KakaoSymbol({size}: {size: number}) {
  return <SvgXml testID="kakao-symbol" xml={XML} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no" />;
}
