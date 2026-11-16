import React from 'react';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {tempCopy} from '../../copy/copy';
import type {DeleteScope} from '../types';

const t = tempCopy.del;

export function DeleteDoneScreen() {
  const navigation = useNavigation();
  const {params} = useRoute();
  const {scope, role} = (params ?? {}) as {scope: DeleteScope; role: 'parent' | 'child'};
  const message = scope === 'family' ? t.doneFamily : role === 'child' ? t.doneChild : t.doneParent;
  return (
    <Screen>
      <Text20 size={28} weight="bold">{message}</Text20>
      <BigButton
        label={t.back}
        onPress={() =>
          navigation.dispatch(
            CommonActions.reset({index: 0, routes: [{name: role === 'child' ? 'Login' : 'Connect'}]}),
          )
        }
      />
    </Screen>
  );
}
