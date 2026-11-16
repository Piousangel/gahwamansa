import React from 'react';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';

export function ChildReport() {
  return (
    <Screen>
      <Text20 size={24} weight="bold">리포트</Text20>
      <Text20>기본 요약은 곧 이곳에서 볼 수 있어요</Text20>
    </Screen>
  );
}
