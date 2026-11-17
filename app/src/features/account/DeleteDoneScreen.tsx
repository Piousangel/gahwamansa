import React, {useEffect, useState} from 'react';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {copy, withTitle} from '../../copy/copy';
import type {DeleteScope} from '../types';

export function DeleteDoneScreen() {
  const navigation = useNavigation();
  const {params} = useRoute();
  const {scope, role, title} = (params ?? {}) as {scope: DeleteScope; role: 'parent' | 'child'; title?: string};
  const [, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const d = copy.delete;
  const message =
    role === 'parent'
      ? d.parent.done
      : scope === 'family'
        ? withTitle(d.child.done_last, title ?? '부모님')
        : d.child.done_keep;
  return (
    <Screen
      bottom={
        <BigButton
          label={role === 'child' ? d.child.back : d.parent.back}
          onPress={() =>
            navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: role === 'child' ? 'Login' : 'Connect'}]}))
          }
        />
      }>
      <Text20 size={28} weight="bold" accessibilityRole="header">{message}</Text20>
      {role === 'child' ? <Text20>{d.child.thanks}</Text20> : null}
    </Screen>
  );
}
