import React from 'react';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {copy} from '../../copy/copy';

// 첫 화면(P0·C0): 어떻게 쓸지 고른다. 설명 줄은 버튼 힌트로도 읽힌다(스크린리더가 버튼과 함께 읽음).
export function RoleSelect({onChoose}: {onChoose: (role: 'parent' | 'child') => void}) {
  const r = copy.role;
  return (
    <Screen>
      <Text20 size={30} weight="bold">{copy.brand.name}</Text20>
      <Text20 size={24}>{copy.connect.greeting}</Text20>
      <Text20 size={28} weight="bold">{r.title}</Text20>
      <BigButton label={r.parent} accessibilityHint={r.parent_sub} onPress={() => onChoose('parent')} />
      <Text20 importantForAccessibility="no" accessibilityElementsHidden>{r.parent_sub}</Text20>
      <BigButton variant="secondary" label={r.child} accessibilityHint={r.child_sub} onPress={() => onChoose('child')} />
      <Text20 importantForAccessibility="no" accessibilityElementsHidden>{r.child_sub}</Text20>
    </Screen>
  );
}
