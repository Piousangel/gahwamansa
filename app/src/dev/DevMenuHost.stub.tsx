// production 번들용 빈 대역(metroDevMenu.js 가 DevMenuHost.tsx 대신 넣는다). 메뉴·세션 보관·테스트 가족 코드가 없다.
// 진입 관문(devGate)의 기본 context 는 아무것도 하지 않으므로 버전 줄을 눌러도 열리지 않는다.
import React from 'react';
import type {Api} from '../features/types';

type Role = 'parent' | 'child';
export function DevMenuHost({children}: {api: Api; children: (p: {appKey: number; role?: Role}) => React.ReactNode}) {
  return <>{children({appKey: 0})}</>;
}
