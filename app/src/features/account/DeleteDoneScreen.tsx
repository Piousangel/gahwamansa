import React from 'react';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import {DsScreen, Heading, Text} from '../../ui/ds';
import {copy, withTitle} from '../../copy/copy';
import type {DeleteScope} from '../types';

// 계정 지운 뒤(어르신·자녀 공용). v4: 부품만 ui/ds — 제목 Heading(머리글·첫 포커스) + 자녀 감사 한 줄 + Dock '처음으로'.
export function DeleteDoneScreen() {
  const navigation = useNavigation();
  const {params} = useRoute();
  const {scope, role, title} = (params ?? {}) as {scope: DeleteScope; role: 'parent' | 'child'; title?: string};
  const d = copy.delete;
  const message = role === 'parent' ? d.parent.done : scope === 'family' ? withTitle(d.child.done_last, title ?? '부모님') : d.child.done_keep;
  return (
    <DsScreen
      variant="form"
      header={<Heading level={1}>{message}</Heading>}
      dock={{
        primary: {
          label: role === 'child' ? d.child.back : d.parent.back,
          onPress: () => navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: role === 'child' ? 'Login' : 'Connect'}]})),
        },
      }}>
      {role === 'child' ? <Text role="bodyLg">{d.child.thanks}</Text> : null}
    </DsScreen>
  );
}
