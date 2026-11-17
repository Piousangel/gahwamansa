import React from 'react';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {copy} from '../../copy/copy';

// 첫 화면(P0·C0): 어떻게 쓸지 고른다. 이전 바 없음. 두 버튼은 하단 고정 영역, 설명은 버튼 힌트로도 읽힌다.
export function RoleSelect({onChoose}: {onChoose: (role: 'parent' | 'child') => void}) {
  const r = copy.role;
  return (
    <Screen
      bottom={
        <>
          <BigButton label={r.parent} accessibilityHint={r.parent_sub} onPress={() => onChoose('parent')} />
          <BigButton variant="secondary" label={r.child} accessibilityHint={r.child_sub} onPress={() => onChoose('child')} />
        </>
      }>
      <Text20 size={30} weight="bold">{copy.brand.name}</Text20>
      <Text20 size={24}>{copy.connect.greeting}</Text20>
      <Text20 size={28} weight="bold">{r.title}</Text20>
      <Text20>{`${r.parent}: ${r.parent_sub}`}</Text20>
      <Text20>{`${r.child}: ${r.child_sub}`}</Text20>
    </Screen>
  );
}
