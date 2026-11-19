import React from 'react';
import {Text as RNText} from 'react-native';
import {keepAllChildren, koreanTextProps} from './koreanText';
import {ds, roleText} from './ds/roles';

// AI 고지 한 줄(디자인 #95 최종, 법무 체크리스트): 사진 바로 아래 'AI가 만든 그림 · 실제 장소가 아니에요'.
// 글자 label 20(inkBody), 사진 설명 유무와 상관없이 항상 같은 자리.
// 예외(R-11): 확대 상한은 label 역할(2.0)이 아니라 고정 상한(fontScaleCap.fixed 1.5) — 200%에서 고지가 길어져
// 질문 첫 문장을 첫 화면 밖으로 밀지 않게 시안이 '200%는 30'으로 정했다(R-18 최소 20은 지킴). 화면은 상한을 고르지 못하므로 ui/ 에 둔다.
export function AiNotice({text, testID = 'ai-notice'}: {text: string; testID?: string}) {
  const r = roleText('label', 'elder');
  return (
    <RNText {...koreanTextProps} testID={testID} maxFontSizeMultiplier={ds.fontScaleCap.fixed} style={r.style}>
      {keepAllChildren(text)}
    </RNText>
  );
}
