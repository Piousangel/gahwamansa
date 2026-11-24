import React from 'react';
import {Text as RNText} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {useAudience} from './audience';
import {ds, roleMark, roleText} from './roles';

/**
 * 팻말 옆 '안 고른 쪽' 한 줄(D-3 어르신 '오늘 한 장', 시안 docs/design/2026-11-24-d2-d3-c4 README 공통 규칙).
 * - 흐림 = 불투명도가 아니라 보조 글자(sub, muted 색) 400
 * - 확대 상한은 팻말 글자(signSmall)와 같은 1.5 — sub 의 2.0 을 그대로 쓰면 200%에서 안 고른 쪽(40)이 팻말 글자(39)보다 커져 위계가 뒤집힌다.
 *   화면은 상한을 고르지 못하므로(lint [DS:fontScale]) ui/ds 에 둔다.
 * 자녀 레인 #239 가 ds/SignPair 를 만들고 있다 — 병합되면 이 부품은 SignPair 로 합친다.
 */
export function SignOther({label, testID = 'sign-other'}: {label: string; testID?: string}) {
  const a = useAudience();
  const r = roleText('sub', a, 'muted');
  return (
    <RNText {...koreanTextProps} {...roleMark('sub')} testID={testID} maxFontSizeMultiplier={ds.type.signSmall.maxFontScale} style={r.style}>
      {keepAllChildren(label)}
    </RNText>
  );
}
