import React from 'react';
import {Image} from 'react-native';

// 브랜드 심볼 D안(살구 인장 '家' + 빛바랜 옛날 사진, DECISIONS 2026-11-17)을 앱 안에서도 그대로 쓴다(사용자 피드백 11-17).
// 원본: design-system/assets/brand/symbol-3d.svg → _src/render.sh app 으로 렌더한 PNG(@1x/2x/3x)를 복사(테스트가 같은지 확인).
// 164: 시작 대기·첫 화면으로 이동(네이티브 스플래시와 같은 크기), 40: 워드마크 옆. 40dp 에서도 상세판이 또렷해 단순판은 쓰지 않는다.
const SRC_40 = require('./symbol-3d-40.png');
const SRC_164 = require('./symbol-3d-164.png');

export function BrandSymbol({size = 48}: {size?: number}) {
  return (
    <Image
      testID="brand-symbol"
      source={size <= 40 ? SRC_40 : SRC_164}
      style={{width: size, height: size}}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
